using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class MainWindow
    {
        private readonly object _elevatedInputBridgeLock = new();
        private NamedPipeServerStream? _elevatedInputBridgePipe;
        private StreamWriter? _elevatedInputBridgeWriter;
        private Process? _elevatedInputBridgeProcess;
        private bool _elevatedInputBridgeConnected;
        private long _elevatedInputBridgeStartAttemptTicks;
        private int _elevatedInputBridgeStartInFlight;
        private int _elevatedInputForegroundCachePid;
        private int _elevatedInputForegroundCacheRequiresBridge;
        private long _elevatedInputForegroundCacheTicks;
        private int _elevatedInputConsentCacheActive;
        private long _elevatedInputConsentCacheTicks;
        private int _elevatedInputBridgeOwnerPid;
        private long _elevatedInputBridgeOwnerHwnd;
        private long _elevatedInputBridgeLastAdminSignalTicks;
        private CancellationTokenSource? _elevatedInputBridgeMonitorCts;

        private const uint TOKEN_QUERY = 0x0008;
        private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
        private const int TokenElevation = 20;

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool GetTokenInformation(
            IntPtr TokenHandle,
            int TokenInformationClass,
            out TOKEN_ELEVATION TokenInformation,
            int TokenInformationLength,
            out int ReturnLength);

        [StructLayout(LayoutKind.Sequential)]
        private struct TOKEN_ELEVATION
        {
            public int TokenIsElevated;
        }

        private async Task<bool> StartElevatedInputBridgeAsync()
        {
            lock (_elevatedInputBridgeLock)
            {
                if (_elevatedInputBridgeConnected &&
                    _elevatedInputBridgeWriter != null &&
                    _elevatedInputBridgePipe?.IsConnected == true)
                {
                    return true;
                }
            }

            StopElevatedInputBridge();

            string helperPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DoorpiInputBridge.exe");
            if (!File.Exists(helperPath))
            {
                Debug.WriteLine("[InputBridge] Helper nao encontrado: " + helperPath);
                return false;
            }

            string pipeName = "DoorpiInputBridge-" + Guid.NewGuid().ToString("N");
            var pipe = new NamedPipeServerStream(
                pipeName,
                PipeDirection.Out,
                1,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous);

            try
            {
                var process = Process.Start(new ProcessStartInfo(helperPath, pipeName)
                {
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                });

                if (process == null)
                {
                    pipe.Dispose();
                    return false;
                }

                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
                await pipe.WaitForConnectionAsync(timeout.Token).ConfigureAwait(false);

                var writer = new StreamWriter(pipe, new UTF8Encoding(false))
                {
                    AutoFlush = true
                };

                lock (_elevatedInputBridgeLock)
                {
                    _elevatedInputBridgePipe = pipe;
                    _elevatedInputBridgeWriter = writer;
                    _elevatedInputBridgeProcess = process;
                    _elevatedInputBridgeConnected = true;
                }

                StartElevatedInputBridgeLifetimeMonitor();
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[InputBridge] Falha ao iniciar helper elevado: " + ex.Message);
                try { pipe.Dispose(); } catch { }
                return false;
            }
        }

        private void StopElevatedInputBridge(int gracefulTimeoutMilliseconds = 0)
        {
            StreamWriter? writer;
            NamedPipeServerStream? pipe;
            Process? process;

            lock (_elevatedInputBridgeLock)
            {
                writer = _elevatedInputBridgeWriter;
                pipe = _elevatedInputBridgePipe;
                process = _elevatedInputBridgeProcess;

                _elevatedInputBridgeWriter = null;
                _elevatedInputBridgePipe = null;
                _elevatedInputBridgeProcess = null;
                _elevatedInputBridgeConnected = false;
                _elevatedInputBridgeOwnerPid = 0;
                _elevatedInputBridgeOwnerHwnd = 0;
                _elevatedInputBridgeLastAdminSignalTicks = 0;

                try { _elevatedInputBridgeMonitorCts?.Cancel(); } catch { }
                _elevatedInputBridgeMonitorCts = null;
            }

            try { writer?.WriteLine("exit"); } catch { }
            try { writer?.Dispose(); } catch { }
            try { pipe?.Dispose(); } catch { }

            try
            {
                if (process != null && gracefulTimeoutMilliseconds > 0 && !process.HasExited)
                    process.WaitForExit(gracefulTimeoutMilliseconds);
                if (process != null && !process.HasExited)
                    process.Kill(entireProcessTree: true);
            }
            catch { }

            try { process?.Dispose(); } catch { }
        }

        private bool TrySendElevatedMouse(int dx, int dy, uint flags, uint data)
            => TrySendElevatedInput($"mouse|{dx}|{dy}|{flags}|{data}");

        private bool TrySendElevatedVirtualKey(ushort vk)
            => TrySendElevatedInput($"key|{vk}");

        private bool TrySendElevatedKeyEvent(ushort vk, bool keyUp)
            => TrySendElevatedInput($"keyevent|{vk}|{(keyUp ? 1 : 0)}");

        private bool TrySendElevatedTerminateProcess(int processId)
            => processId > 0 && TrySendElevatedInput($"kill|{processId}");

        private bool TrySendElevatedUnicodeString(string text)
        {
            if (string.IsNullOrEmpty(text)) return true;
            string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
            return TrySendElevatedInput("unicode|" + encoded);
        }

        private bool TrySendElevatedInput(string command)
        {
            lock (_elevatedInputBridgeLock)
            {
                if (!_elevatedInputBridgeConnected ||
                    _elevatedInputBridgeWriter == null ||
                    _elevatedInputBridgePipe?.IsConnected != true)
                {
                    return false;
                }

                try
                {
                    _elevatedInputBridgeWriter.WriteLine(command);
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[InputBridge] Falha ao enviar input elevado: " + ex.Message);
                    _elevatedInputBridgeConnected = false;
                    return false;
                }
            }
        }

        private bool IsElevatedInputBridgeConnected()
        {
            lock (_elevatedInputBridgeLock)
            {
                return _elevatedInputBridgeConnected &&
                       _elevatedInputBridgeWriter != null &&
                       _elevatedInputBridgePipe?.IsConnected == true;
            }
        }

        private bool ShouldUseElevatedInputForForeground()
        {
            if (IsAdminConsentUiLikelyActive())
            {
                MarkElevatedInputBridgeAdminSignal();
                return true;
            }

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                GetWindowProcessId(foreground, out var pidRaw);
                int pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId)
                    return false;

                long now = Environment.TickCount64;
                if (pid == Volatile.Read(ref _elevatedInputForegroundCachePid) &&
                    now - Interlocked.Read(ref _elevatedInputForegroundCacheTicks) < 1000)
                {
                    bool cachedElevated = Volatile.Read(ref _elevatedInputForegroundCacheRequiresBridge) == 1;
                    if (cachedElevated)
                        MarkElevatedInputBridgeTarget(pid, foreground);
                    return cachedElevated;
                }

                bool elevated = IsProcessElevated(pid);
                Volatile.Write(ref _elevatedInputForegroundCachePid, pid);
                Volatile.Write(ref _elevatedInputForegroundCacheRequiresBridge, elevated ? 1 : 0);
                Interlocked.Exchange(ref _elevatedInputForegroundCacheTicks, now);
                if (elevated)
                    MarkElevatedInputBridgeTarget(pid, foreground);
                return elevated;
            }
            catch
            {
                return IsElevatedInputBridgeConnected();
            }
        }

        private static bool IsProcessElevated(int processId)
        {
            IntPtr processHandle = IntPtr.Zero;
            IntPtr token = IntPtr.Zero;
            try
            {
                processHandle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
                if (processHandle == IntPtr.Zero)
                    return Marshal.GetLastWin32Error() == 5;

                if (!OpenProcessToken(processHandle, TOKEN_QUERY, out token))
                    return Marshal.GetLastWin32Error() == 5;

                return GetTokenInformation(
                           token,
                           TokenElevation,
                           out var elevation,
                           Marshal.SizeOf<TOKEN_ELEVATION>(),
                           out _) &&
                       elevation.TokenIsElevated != 0;
            }
            catch
            {
                return false;
            }
            finally
            {
                if (processHandle != IntPtr.Zero)
                {
                    try { CloseHandle(processHandle); } catch { }
                }

                if (token != IntPtr.Zero)
                {
                    try { CloseHandle(token); } catch { }
                }
            }
        }

        private bool IsAdminConsentUiLikelyActive()
        {
            long now = Environment.TickCount64;
            if (now - Interlocked.Read(ref _elevatedInputConsentCacheTicks) < 1000)
                return Volatile.Read(ref _elevatedInputConsentCacheActive) == 1;

            bool active = false;
            try
            {
                active = Process.GetProcessesByName("consent").Any(p =>
                {
                    try { return !p.HasExited; }
                    catch { return true; }
                    finally { try { p.Dispose(); } catch { } }
                });
            }
            catch { }

            Volatile.Write(ref _elevatedInputConsentCacheActive, active ? 1 : 0);
            Interlocked.Exchange(ref _elevatedInputConsentCacheTicks, now);
            return active;
        }

        private void MarkElevatedInputBridgeAdminSignal()
        {
            Interlocked.Exchange(ref _elevatedInputBridgeLastAdminSignalTicks, DateTime.UtcNow.Ticks);
        }

        private void MarkElevatedInputBridgeTarget(int pid, IntPtr hwnd)
        {
            if (pid <= 0 || pid == Environment.ProcessId)
                return;

            Volatile.Write(ref _elevatedInputBridgeOwnerPid, pid);
            Interlocked.Exchange(ref _elevatedInputBridgeOwnerHwnd, hwnd.ToInt64());
            MarkElevatedInputBridgeAdminSignal();
        }

        private void StartElevatedInputBridgeLifetimeMonitor()
        {
            CancellationTokenSource monitorCts;
            lock (_elevatedInputBridgeLock)
            {
                try { _elevatedInputBridgeMonitorCts?.Cancel(); } catch { }
                _elevatedInputBridgeMonitorCts = new CancellationTokenSource();
                monitorCts = _elevatedInputBridgeMonitorCts;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!monitorCts.IsCancellationRequested)
                    {
                        await Task.Delay(1000, monitorCts.Token).ConfigureAwait(false);
                        if (monitorCts.IsCancellationRequested)
                            return;

                        if (!IsElevatedInputBridgeConnected())
                            return;

                        if (!IsAnyControllerMouseKeyboardSessionActive())
                        {
                            StopElevatedInputBridge();
                            return;
                        }

                        int ownerPid = Volatile.Read(ref _elevatedInputBridgeOwnerPid);
                        if (ownerPid > 0 && !IsProcessStillAlive(ownerPid))
                        {
                            // Desinstaladores podem trocar o launcher por outro
                            // processo/janela. Preserve a ponte durante esse handoff;
                            // o monitor de armazenamento reassociará o novo destino.
                            if (IsStorageUninstallerSessionActive())
                            {
                                Volatile.Write(ref _elevatedInputBridgeOwnerPid, 0);
                                Interlocked.Exchange(ref _elevatedInputBridgeOwnerHwnd, 0);
                                continue;
                            }
                            StopElevatedInputBridge();
                            return;
                        }

                        long ownerHwndRaw = Interlocked.Read(ref _elevatedInputBridgeOwnerHwnd);
                        if (ownerPid <= 0 && ownerHwndRaw != 0 && !IsWindow(new IntPtr(ownerHwndRaw)))
                        {
                            if (IsStorageUninstallerSessionActive())
                            {
                                Interlocked.Exchange(ref _elevatedInputBridgeOwnerHwnd, 0);
                                continue;
                            }
                            StopElevatedInputBridge();
                            return;
                        }

                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex)
                {
                    Debug.WriteLine("[InputBridge] Monitor do helper elevado falhou: " + ex.Message);
                }
            }, monitorCts.Token);
        }

        private static bool IsProcessStillAlive(int pid)
        {
            try
            {
                using var process = Process.GetProcessById(pid);
                return !process.HasExited;
            }
            catch
            {
                return false;
            }
        }

        private bool IsAnyControllerMouseKeyboardSessionActive()
        {
            try
            {
                return _mediaMouseActive ||
                       (_mediaExeModeActive && !_mediaExeMouseInputTemporarilyDisabled) ||
                       _storeMouseModeActive ||
                       _gameLaunchStoreMouseModeActive ||
                        _dialogModeActive ||
                        _systemControllerActive ||
                        IsStorageUninstallerSessionActive() ||
                        IsDoorpiFileExplorerLaunchActive() ||
                       IsStoreInstallFlowActive() ||
                       IsGpuUpdaterSessionActive();
            }
            catch
            {
                return false;
            }
        }

        private void EnsureElevatedInputBridgeForForeground()
        {
            if (IsElevatedInputBridgeConnected())
                return;

            long now = Environment.TickCount64;
            long lastAttempt = Interlocked.Read(ref _elevatedInputBridgeStartAttemptTicks);
            if (now - lastAttempt < 5000)
                return;

            if (Interlocked.Exchange(ref _elevatedInputBridgeStartInFlight, 1) == 1)
                return;

            Interlocked.Exchange(ref _elevatedInputBridgeStartAttemptTicks, now);
            _ = Task.Run(async () =>
            {
                try { await StartElevatedInputBridgeAsync().ConfigureAwait(false); }
                finally { Interlocked.Exchange(ref _elevatedInputBridgeStartInFlight, 0); }
            });
        }

        private bool TryRouteInputThroughElevatedBridgeIfNeeded()
        {
            if (!ShouldUseElevatedInputForForeground())
                return false;

            EnsureElevatedInputBridgeForForeground();
            return true;
        }
    }
}
