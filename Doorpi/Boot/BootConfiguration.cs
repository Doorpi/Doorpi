using Microsoft.Win32;
using System;
using System.IO;

namespace Doorpi;

internal static class BootConfiguration
{
    internal const string KeyPath = @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon";
    private const string BackupPresent = "DoorpiShellBackupPresent";
    private const string BackupValue = "DoorpiPreviousShell";
    private const string SoundKey = @"AppEvents\Schemes\Apps\.Default\SystemStart\.Current";
    internal static bool IsDoorpiShell(string? command)
    {
        if (string.IsNullOrWhiteSpace(command)) return false;
        string value = command.Trim();
        string executable = value.StartsWith('"') ? value.Split('"')[1] : value.Split(' ')[0];
        return string.Equals(Path.GetFileName(executable), "Doorpi.exe", StringComparison.OrdinalIgnoreCase);
    }
    internal static bool IsConfigured
    {
        get
        {
            try { using var key = Registry.CurrentUser.OpenSubKey(KeyPath); return IsDoorpiShell(key?.GetValue("Shell") as string); }
            catch (System.Security.SecurityException) { return false; }
            catch (UnauthorizedAccessException) { return false; }
        }
    }
    internal static void Enable(string executable)
    {
        using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
        string? previous = key.GetValue("Shell", null, RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
        if (!IsDoorpiShell(previous))
        {
            if (!string.IsNullOrWhiteSpace(previous))
            {
                key.SetValue(BackupValue, previous);
                key.SetValue("DoorpiPreviousShellKind", (int)key.GetValueKind("Shell"), RegistryValueKind.DWord);
            }
            else key.DeleteValue(BackupValue, false);
            key.SetValue(BackupPresent, 1, RegistryValueKind.DWord);
            using var sound = Registry.CurrentUser.OpenSubKey(SoundKey);
            if (sound?.GetValue("", null, RegistryValueOptions.DoNotExpandEnvironmentNames) is string originalSound)
            {
                key.SetValue("DoorpiPreviousStartupSound", originalSound);
                key.SetValue("DoorpiPreviousStartupSoundKind", (int)sound.GetValueKind(""), RegistryValueKind.DWord);
                key.SetValue("DoorpiSoundBackupPresent", 1, RegistryValueKind.DWord);
            }
            else key.SetValue("DoorpiSoundBackupPresent", 0, RegistryValueKind.DWord);
        }
        key.SetValue("Shell", $"\"{executable}\" --doorpi-shell-bootstrap");
    }
    internal static void Restore()
    {
        using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
        if (!IsDoorpiShell(key.GetValue("Shell") as string)) return;
        if (key.GetValue(BackupPresent) is int present && present == 1 && key.GetValue(BackupValue) is string previous)
            key.SetValue("Shell", previous, StoredKind(key, "DoorpiPreviousShellKind"));
        else key.DeleteValue("Shell", false); // Includes older installs without a backup.
        using var sound = Registry.CurrentUser.CreateSubKey(SoundKey);
        if (sound.GetValue("") as string == "" && key.GetValue("DoorpiSoundBackupPresent") is int hasSound)
        {
            if (hasSound == 1 && key.GetValue("DoorpiPreviousStartupSound") is string previousSound)
                sound.SetValue("", previousSound, StoredKind(key, "DoorpiPreviousStartupSoundKind"));
            else sound.DeleteValue("", false);
        }
        else if (sound.GetValue("") as string == "") sound.DeleteValue("", false); // Legacy mute.
        key.DeleteValue("DoorpiSoundBackupPresent", false);
        key.DeleteValue("DoorpiPreviousStartupSound", false);
        key.DeleteValue("DoorpiPreviousStartupSoundKind", false);
        key.DeleteValue("DoorpiPreviousShellKind", false);
        key.DeleteValue(BackupPresent, false);
        key.DeleteValue(BackupValue, false);
    }

    private static RegistryValueKind StoredKind(RegistryKey key, string name) =>
        key.GetValue(name) is int kind && kind == (int)RegistryValueKind.ExpandString
            ? RegistryValueKind.ExpandString : RegistryValueKind.String;
}
