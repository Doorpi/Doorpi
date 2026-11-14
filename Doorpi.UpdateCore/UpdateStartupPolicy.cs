namespace Doorpi.UpdateCore;

/// <summary>Prevents ordinary launches from opening data during an unfinished update.</summary>
public static class UpdateStartupPolicy
{
    public static bool IsRecoveryRequired(UpdateOperationState? state, string? healthSignal)
    {
        if (state == null || !string.Equals(state.Component, "doorpi", StringComparison.OrdinalIgnoreCase)) return false;
        bool pending = string.Equals(state.Phase, "doorpi-applied-pending-health-check", StringComparison.OrdinalIgnoreCase);
        if (pending && state.StorageMigrationStarted && state.StorageMigrationCompleted &&
            state.StorageSchemaVersion > 0 && state.StorageSchemaVersion <= UpdateStorageCompatibility.SupportedStorageSchemaVersion &&
            !string.IsNullOrWhiteSpace(state.HealthSignalPath) &&
            string.Equals(state.HealthSignalPath, healthSignal, StringComparison.Ordinal)) return false;

        return pending || state.Phase?.ToLowerInvariant() is "storage-migrating" or "storage-migrated" or
            "applying" or "rollback" or "rollback-failed" or "doorpi-health-check-failed";
    }
}
