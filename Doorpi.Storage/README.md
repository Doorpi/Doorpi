# Doorpi.Storage

The application state database is `<Doorpi app-data root>/storage/doorpi.db`, outside
`Data` and its WebView resource mapping. This library targets .NET 8 and has no WPF
dependency. It uses Microsoft.Data.Sqlite 10.0.14 with an explicit
SQLitePCLRaw.bundle_e_sqlite3 3.0.5 dependency. The regression harness verifies the
actual native runtime is SQLite 3.53.4 or later.

## Ownership and compatibility

`StoragePathPolicy` is the exhaustive allowlist for logical state paths. Legacy
absolute paths identify database records; they do not imply physical JSON files.
Chromium databases/preferences, extension and intro manifests, ROM metadata,
OAuth client configuration, and signed update/package manifests remain external.
The updater's `updates/state.json`, `manifest-state.json`, `manifest-cache.json`
and `boot-startup-experiment.json` remain physical bootstrap compatibility
contracts because earlier updaters and boot selection read them before storage
initialization. Legacy binary `.dpapi` tokens are imported by the OAuth adapter
into encrypted `.token.json` envelopes, rather than decoded as text here.

`StateStorage.Initialize(root)` performs cutover. `HandlesPath` identifies
ownership without importing data. Other state APIs lazily initialize only a
matching registered/default root. External paths retain System.IO behavior.
After cutover an absent logical record never falls back to an old physical JSON
or another user's global mirror. `current-user.json` is a historical raw-text
record; it is intentionally not parsed as JSON.

## Canonical rows and transactions

Users, games, game history, media history, control profiles, bindings and
assignments have indexed SQL tables. Other catalog arrays use `entities`;
top-level cache/permission arrays use `nested_entities`. Extensible fields remain
in the JSON payload **of each entity**. Collection documents keep only their
metadata envelopes; compatibility reads reconstruct the collection from SQL.
Control bindings are reconstructed from their own rows. Small settings and
immutable cloud interchange snapshots remain validated documents.

Rows have a persistent ID, source path, explicit owner scope, ordinal and version.
Foreign keys enforce owner/source agreement, source deletion and profile/binding
relationships. IDs generated for legacy entities use the owner/source and natural
identity; they are persisted in the returned entity payload. Ambiguous natural
duplicates are preserved with persisted disambiguators and an `identity_conflicts`
entry. Duplicate explicit IDs are rejected, allowing migration to try a valid
backup. Built-in control assignments can reference profiles supplied by the
application, so assignments do not impose a foreign key to custom profiles.

Use `ReadSnapshot(paths)` to capture data and per-document revisions consistently.
Use `WriteBatchIfRevision(writes, snapshot.Revisions)` to commit related writes and
deletions together. A missing document has revision zero. Any revision mismatch
throws `StorageConflictException` and rolls back the whole operation. `WriteBatch`
is for operations already coordinated by a higher-level transaction.
`ExecuteTransaction(root, Action)` is synchronous, ambient and reentrant; do not
put `await` or cross-root operations inside it. `UpdateCollectionItem` patches one
entity plus its indexed columns with a document revision precondition, avoiding
serialization and rewriting of unrelated entity rows. Owner and entity ID cannot
be patched. Bulk compatibility writes replace a collection atomically; document
revision, rather than per-row version, is their concurrency boundary.

Connections have foreign keys enabled, a bounded busy timeout, no pooling and
`synchronous=FULL`. The initial journal policy is SQLite's rollback journal
(`delete`), deliberately avoiding a WAL rollout in the same schema migration.
The harness kills its own fixture process before commit and checks recovery.

## Migration and rollback

Cutover uses a named per-root mutex and one import transaction. All recognized
legacy sources and backups are copied to an immutable snapshot first. Primary
JSON is validated structurally, including explicit entity identities/ownership;
invalid primaries try `.bak`. If neither is valid, the whole import fails and
the original files remain unchanged. Provenance records the chosen source,
SHA-256 of its original bytes, recovery choice and snapshot directory. The
completion marker commits in the same transaction. Later starts do not reimport
stale legacy files.

`StorageMigration.Prepare(root, operationId)` snapshots the existing database using
SQLite's backup API, preserves legacy files, durably writes a reconstructible
checkpoint receipt, then runs migration. Repeating an interrupted preparation
resumes cutover against the original checkpoint. `LoadCheckpoint` finds that
receipt after updater interruption. `Restore(checkpoint)` restores the prior
database, or removes the newly created database when the previous application
had none, and restores the checkpoint's original legacy files. Call this only
after the Doorpi process exits. Checkpoints are not deleted automatically.

`BackupTo`/`RestoreFrom` validate SQLite integrity and use the SQLite backup API;
copying an active database file is not a supported backup mechanism. `CheckIntegrity`
also checks foreign keys. Schema versions newer than this library are rejected.

## Regression harness

### Incremental collection persistence

Flat entity collections use stable-ID UPSERTs and delete only IDs absent from the
incoming collection. Unchanged payloads and ordinals do not update the row or its
entity version. Changes of order advance the affected row version. The document
revision remains the aggregate concurrency token and still advances on a save.
`ReadEntitySnapshot` returns canonical rows and that revision in a deferred read
transaction; library/history consumers deserialize individual rows instead of
reconstructing and reparsing a full JSON array. Control reads fetch all bindings
in one query rather than one query per profile.

This does not remove full-input validation, the previous aggregate recovery
snapshot, per-row JSON extension payloads, or aggregate replacement of controls
and other nested arrays. The later local-catalog migration introduces schema 2;
see `docs/architecture/sqlite-local-catalog.md` for its boundaries and rollback.

Cloud JSON remains a versioned interchange contract. Existing revision-checked
batch applies benefit from incremental collection writes in the same transaction.
Local entity versions are not a remote concurrency protocol. Atomic remote
preconditions and real two-device conflict tests remain necessary before claiming
cross-device lost-update protection.

Run `dotnet run --project Doorpi.Storage.Tests`. Fixtures live only under the
test build output, never under the real user's app-data root. Tests cover import,
corrupt sources/backups, semantic corruption, persistent IDs, normalized rows,
owner constraints, CAS, related writes/deletes, independent writers, SQLite
backup/rollback, an interrupted fixture process, and bounded file inventories.
