using Doorpi.Storage;

namespace Doorpi.UpdateCore;

public static class UpdateRollback
{
    /// <summary>Called only after the updated UI and its supervisor have stopped.</summary>
    public static void Restore(UpdateOperationState state, string appDataFolder)
    {
        ArgumentNullException.ThrowIfNull(state);
        if (state.StorageMigrationStarted)
        {
            var checkpoint = StorageMigration.LoadCheckpoint(appDataFolder, state.OperationId);
            if (checkpoint != null)
                StorageMigration.Restore(checkpoint);
            else if (state.StorageMigrationCompleted)
                throw new InvalidDataException("O checkpoint dos dados não foi encontrado. Os backups foram preservados para recuperação.");
        }
        if (!string.IsNullOrWhiteSpace(state.BackupFolder) && Directory.Exists(state.BackupFolder))
            new ComponentInstaller(["Data", "updates", "Updater"]).Rollback(state.BackupFolder, state.InstallFolder);
        else if (state.BinaryApplyStarted)
            throw new InvalidDataException("O backup dos arquivos da atualização não foi encontrado. A inicialização foi bloqueada para preservar os dados.");
    }
}
