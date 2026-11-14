$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../Doorpi/MainWindow.Emulators.cs'))
$start = $source.IndexOf('if (scanMode == "rpcs3")', $source.IndexOf('foreach (var scanFolder in scanFolders)'))
$end = $source.IndexOf('else if (scanMode == "vita3k")', $start)
$body = $source.Substring($start, $end - $start)
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Collections.Generic;
public static class Rpcs3ScanRegression {
    static DirectoryInfo gameRoot;
    static bool bootable;
    static DirectoryInfo FindParentContainingFile(string file, string name) => gameRoot;
    static bool IsRpcS3InternalInstalledGame(string file, DirectoryInfo root) => bootable;
    static bool Include(string file, bool configured, bool hasSfo, bool isBootable) {
        gameRoot = hasSfo ? new DirectoryInfo(Path.GetTempPath()) : null;
        bootable = isBootable;
        var scanFolder = (Path: "roms", IsConfigured: configured);
        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".elf", ".self" };
        string scanMode = "rpcs3";
        // Execute the actual compatibility rule for saved configurations.
        $([regex]::Match($source, 'if \(scanMode == "rpcs3"\) extensions.Add\(".iso"\);').Value)
        string fileName = Path.GetFileName(file);
        string extension = Path.GetExtension(file);
        bool include = extensions.Contains(extension);
        $body
        return include;
    }
    public static void Run() {
        Check("disc.ISO", true, false, true, true);
        Check("disc.iso", false, false, true, false);
        Check("demo.elf", true, false, true, true);
        Check("demo.self", true, false, true, true);
        Check("EBOOT.BIN", true, true, true, true);
        Check("EBOOT.BIN", false, true, true, true);
        Check("EBOOT.BIN", false, true, false, false);
        Check("EBOOT.BIN", true, false, true, false);
        Check("data.bin", true, true, true, false);
        Check("update.pkg", true, false, true, false);
    }
    static void Check(string file, bool configured, bool sfo, bool boot, bool expected) {
        if (Include(file, configured, sfo, boot) != expected)
            throw new Exception("Unexpected scan result: " + file + " configured=" + configured + " sfo=" + sfo + " bootable=" + boot);
    }
}
"@
[Rpcs3ScanRegression]::Run()
Write-Output 'PASS: 10 RPCS3 scan regression cases (ISO with saved extensions, ELF/SELF, extracted and installed games, updates and unrelated files).'