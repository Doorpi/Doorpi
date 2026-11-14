// Legacy path identifiers are routed to the transactional SQLite state store.
// External application files, media and distribution contracts remain filesystem I/O.
global using File = Doorpi.Storage.StateFile;
