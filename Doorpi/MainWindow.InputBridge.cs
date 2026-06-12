using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
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

                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[InputBridge] Falha ao iniciar helper elevado: " + ex.Message);
                try { pipe.Dispose(); } catch { }
                return false;
            }
        }

        private void StopElevatedInputBridge()
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
            }

            try { writer?.WriteLine("exit"); } catch { }
            try { writer?.Dispose(); } catch { }
            try { pipe?.Dispose(); } catch { }

            try
            {
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
    }
}
