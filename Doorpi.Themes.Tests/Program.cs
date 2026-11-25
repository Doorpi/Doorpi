using System.Text.Json.Nodes;
using Doorpi.Storage;
using Doorpi.Themes;

// All state belongs to this isolated fixture, never the installed Doorpi profile.
string root = Path.Combine(AppContext.BaseDirectory, "test-data", Guid.NewGuid().ToString("N"));
string data = Path.Combine(root, "Data");
Directory.CreateDirectory(data);
string User(string id) => Path.Combine(data, "users", id, "user.json");
string Settings(string id) => Path.Combine(data, "users", id, "display-settings.json");
int count = 0;
void Check(bool result, string message) { if (!result) throw new Exception(message); count++; }
void Reject<T>(Action action) where T : Exception
{
    try { action(); } catch (T) { count++; return; }
    throw new Exception("Expected " + typeof(T).Name);
}
Directory.CreateDirectory(Path.GetDirectoryName(User("legacy"))!);
File.WriteAllText(User("legacy"), "{\"Id\":\"legacy\"}");
File.WriteAllText(Settings("legacy"), "{\"layoutScale\":1.25}");
File.WriteAllText(Path.Combine(data,"theme-settings.json"),"{\"version\":1,\"login\":\"default\"}");
StateStorage.Initialize(root);
var store = new ThemePreferenceStore(data);
Check(store.Read("legacy").ThemeId == "default", "Legacy appearance defaults unchanged");
var before = store.Read("legacy");
store.Save("legacy", "orbit", before.Revision, before.ProfileRevision);
Check(File.ReadAllText(Settings("legacy")) == "{\"layoutScale\":1.25}", "Legacy source preserved");
Check(JsonNode.Parse(StateStorage.ReadAllText(Settings("legacy")))!["layoutScale"]!.GetValue<double>() == 1.25, "Unknown fields preserved");

StateStorage.WriteAllText(User("a"), "{\"Id\":\"a\"}");
StateStorage.WriteAllText(User("b"), "{\"Id\":\"b\"}");
var first = store.Read("a");
Check(first.ThemeId == "default", "Clean profile default");
var saved = store.Save("a", "orbit", first.Revision, first.ProfileRevision);
Check(saved.ThemeId == "orbit" && saved.Revision > first.Revision, "SQLite commit revision");
Check(store.Read("b").ThemeId == "default", "Profile isolation");
Check(!File.Exists(Settings("a")), "No physical preference JSON");
Reject<StorageConflictException>(() => store.Save("a", "default", first.Revision, first.ProfileRevision));
StateStorage.WriteAllText(User("a"), "{\"Id\":\"a\",\"Name\":\"changed\"}");
Reject<StorageConflictException>(() => store.Save("a", "default", saved.Revision, saved.ProfileRevision));
saved = store.Read("a");
string backup = Path.Combine(root, "theme-backup.sqlite");
StateStorage.CreateBackup(backup);
store.Save("a", "default", saved.Revision, saved.ProfileRevision);
Check(store.Read("a").ThemeId == "default", "Restore Default persists");
StateStorage.RestoreBackup(backup);
Check(store.Read("a").ThemeId == "orbit", "Updater-compatible SQLite rollback");
StateStorage.Delete(User("b"));
Reject<InvalidDataException>(() => store.Read("b"));
Reject<ArgumentException>(() => store.Read("../a"));
foreach (string corrupt in new[] { "[]", "{\"themeId\":null}", "{\"themeId\":42}", "{\"themePreferenceVersion\":2}" })
{
    StateStorage.WriteAllText(Settings("a"), corrupt);
    Reject<InvalidDataException>(() => store.Read("a"));
    Reject<InvalidDataException>(() => store.Save("a", "default", 0, 0));
    Check(StateStorage.ReadAllText(Settings("a")) == corrupt, "Corrupt preference preserved");
}

string web = Path.Combine(root, "wwwroot"), catalog = Path.Combine(web, "themes", "catalog.json");
Directory.CreateDirectory(Path.Combine(web, "themes", "builtin"));
File.WriteAllText(Path.Combine(web, "themes", "builtin", "orbit.json"), "{}");
string valid = "{\"schemaVersion\":1,\"themes\":[{\"id\":\"default\",\"name\":\"Default\",\"description\":\"Original\",\"manifest\":null},{\"id\":\"orbit\",\"name\":\"Orbit\",\"description\":\"Console\",\"manifest\":\"themes/builtin/orbit.json\"}]}";
File.WriteAllText(catalog, valid);
Check(ThemeCatalog.Load(web).Length == 2, "Installed catalog accepted");
foreach (string invalid in new[] { valid.Replace("themes/builtin/orbit.json", "../secret.json"), valid.Replace("themes/builtin/orbit.json", "https://example.com/theme.json"), valid.Replace("\"id\":\"orbit\"", "\"id\":\"default\""), "{\"schemaVersion\":1,\"themes\":[null]}" })
{
    File.WriteAllText(catalog, invalid);
    Reject<InvalidDataException>(() => ThemeCatalog.Load(web));
}
StateStorage.WriteAllText(User("components"),"{\"Id\":\"components\"}");
var initial=store.Read("components");
var home=store.Save("components","orbit",initial.Revision,initial.ProfileRevision,"home");
var menu=store.Save("components","pkg-0123456789abcdef01234567",home.Revision,home.ProfileRevision,"nav-menu");
Check(menu.Parts!["home"]=="orbit" && menu.Parts["nav-menu"]=="pkg-0123456789abcdef01234567", "Independent component preferences");
var restored=store.Save("components","default",menu.Revision,menu.ProfileRevision,"home");
Check(restored.Parts!["nav-menu"]==menu.Parts["nav-menu"],"Reset one area preserves another");
var device=store.ReadDevice();Check(device.ThemeId=="default","Clean device login theme");
store.SaveDevice("components","pkg-0123456789abcdef01234567",device.Revision,restored.ProfileRevision);
Check(store.ReadDevice().ThemeId=="pkg-0123456789abcdef01234567","Login preference belongs to device");
Check(File.ReadAllText(Path.Combine(data,"theme-settings.json"))=="{\"version\":1,\"login\":\"default\"}","Legacy device preference source preserved after SQLite commit");
var otherArea=store.Read("components");
Reject<InvalidDataException>(()=>store.Save("components","default",otherArea.Revision,otherArea.ProfileRevision,"login"));
Reject<StorageConflictException>(()=>store.SaveDevice("components","default",device.Revision,restored.ProfileRevision));
StateStorage.WriteAllText(Path.Combine(data,"theme-settings.json"),"{\"version\":9}");
Reject<InvalidDataException>(()=>store.SaveDevice("components","default",0,restored.ProfileRevision));
Check(StateStorage.ReadAllText(Path.Combine(data,"theme-settings.json"))=="{\"version\":9}","Device corruption preserved");

string Zip(string name,Dictionary<string,string> files)
{
    string file=Path.Combine(root,name+".doorpitheme");
    using var stream=File.Create(file);using var zip=new System.IO.Compression.ZipArchive(stream,System.IO.Compression.ZipArchiveMode.Create);
    foreach(var entry in files){using var writer=new StreamWriter(zip.CreateEntry(entry.Key).Open());writer.Write(entry.Value);}
    return file;
}
const string packageManifest="{\"schemaVersion\":1,\"apiVersion\":1,\"id\":\"test-package\",\"name\":\"Test\",\"version\":\"1.0.0\",\"author\":\"Fixture\",\"parts\":{\"home\":{\"css\":\"parts/home.css\"},\"nav-menu\":{\"css\":\"parts/menu.css\"}}}";
var good=new Dictionary<string,string>{{"theme.json",packageManifest},{"parts/home.css",":scope{color:red}"},{"parts/menu.css",":scope{color:blue}"}};
string goodZip=Zip("good",good),packagesRoot=Path.Combine(data,"theme-packages");
var staged=ThemePackage.Stage(goodZip);string installed=ThemePackage.Commit(packagesRoot,staged);
Check(ThemePackage.Catalog(packagesRoot).Single().Parts!.Length==2,"Installed package advertises actual areas");
Check(ThemePackage.Commit(packagesRoot,staged)==installed,"Immutable duplicate import is idempotent");
Check(ThemePackage.Read(packagesRoot,installed)!=null,"Installed payload readable");
Check(File.Exists(goodZip),"Original package preserved");
Directory.CreateDirectory(Path.Combine(packagesRoot,".staging-interrupted"));
File.WriteAllText(Path.Combine(packagesRoot,".staging-interrupted","theme.json"),packageManifest);
Check(ThemePackage.Catalog(packagesRoot).Count()==1,"Interrupted staging is not an installed package");
foreach(var (name,extra) in new[]{("traversal","../outside.css"),("script","assets/run.js"),("html","parts/run.html"),("absolute","/outside.css"),("case","PARTS/home.css"),("device","parts/NUL.css"),("normalized-alias","parts/sub./alias.css")})
{
    var bad=new Dictionary<string,string>(good){{extra,"bad"}};
    Reject<InvalidDataException>(()=>ThemePackage.Stage(Zip(name,bad)));
}
Reject<System.Text.Json.JsonException>(()=>ThemePackage.ParseManifest(packageManifest.Replace("\"author\":","\"script\":\"run.js\",\"author\":")));
Reject<InvalidDataException>(()=>ThemePackage.Find(packagesRoot,"../outside"));
if(args.Length==1){var exported=ThemePackage.Stage(Path.GetFullPath(args[0]));Check(exported.Manifest.Parts.Count==5,"Node SDK export is accepted by native installer");}
StateStorage.WriteAllText(User("reset"),"{\"Id\":\"reset\"}");
StateStorage.WriteAllText(Settings("reset"),"{\"layoutScale\":1.25,\"future\":\"keep\",\"themeId\":\"orbit\",\"themeParts\":{\"home\":\"orbit\",\"nav-menu\":\"pkg-menu\",\"side-panels\":\"orbit\",\"popups\":\"pkg-popup\"}}");
StateStorage.WriteAllText(Path.Combine(data,"theme-settings.json"),"{\"version\":1,\"login\":\"pkg-login\",\"future\":42}");
var resetProfile=store.Read("reset");var resetDevice=store.ReadDevice();
Reject<StorageConflictException>(()=>store.ResetAll("reset",resetProfile.Revision-1,resetProfile.ProfileRevision,resetDevice.Revision));
Check(store.Read("reset").ThemeId=="orbit"&&store.ReadDevice().ThemeId=="pkg-login","Stale profile revision leaves both reset documents untouched");
Reject<StorageConflictException>(()=>store.ResetAll("reset",resetProfile.Revision,resetProfile.ProfileRevision,resetDevice.Revision-1));
Check(store.Read("reset").ThemeId=="orbit"&&store.ReadDevice().ThemeId=="pkg-login","Stale device revision cannot partially reset profile");
var unchangedProfile=store.Read("legacy");
store.ResetAll("reset",resetProfile.Revision,resetProfile.ProfileRevision,resetDevice.Revision);
Check(store.Read("reset").Parts!.Values.All(id=>id=="default")&&store.ReadDevice().ThemeId=="default","All five areas reset atomically");
var resetSettings=JsonNode.Parse(StateStorage.ReadAllText(Settings("reset")))!;
Check(resetSettings["layoutScale"]!.GetValue<double>()==1.25&&resetSettings["future"]!.GetValue<string>()=="keep","Reset preserves unrelated profile settings");
Check(JsonNode.Parse(StateStorage.ReadAllText(Path.Combine(data,"theme-settings.json")))!["future"]!.GetValue<int>()==42,"Reset preserves unrelated device fields");
Check(store.Read("legacy").ThemeId==unchangedProfile.ThemeId&&store.Read("legacy").Revision==unchangedProfile.Revision,"Other profiles are not reset");
Check(ThemePackage.Catalog(packagesRoot).Count()==1,"Reset does not remove installed packages");
resetProfile=store.Read("reset");store.Save("reset","orbit",resetProfile.Revision,resetProfile.ProfileRevision,"home");resetProfile=store.Read("reset");
StateStorage.WriteAllText(Path.Combine(data,"theme-settings.json"),"{\"version\":9}");
Reject<InvalidDataException>(()=>store.ResetAll("reset",resetProfile.Revision,resetProfile.ProfileRevision,0));
Check(store.Read("reset").ThemeId=="orbit","Corrupt device preference prevents partial profile reset");
var systemBefore=store.Read("reset");
systemBefore=store.Save("reset","retrato",systemBefore.Revision,systemBefore.ProfileRevision,"profile");
Check(systemBefore.Parts!["profile"]=="default","Retired built-in uses the standard profile");
systemBefore=store.Save("reset","pkg-profile-test",systemBefore.Revision,systemBefore.ProfileRevision,"profile");
store.Save("reset","orbit",systemBefore.Revision,systemBefore.ProfileRevision,"system");
var expectedParts=store.Read("reset").Parts!;
Check(expectedParts["profile"]=="pkg-profile-test" && expectedParts.Where(part=>part.Key!="profile").All(part=>part.Value=="orbit"),"System selection preserves independent profile appearance");
Check(StateStorage.ReadAllText(Path.Combine(data,"theme-settings.json"))=="{\"version\":9}","System selection never reads or overwrites device login");
Reject<StorageConflictException>(()=>store.Save("reset","default",systemBefore.Revision,systemBefore.ProfileRevision,"system"));
Check(store.Read("reset").Parts!.All(part=>part.Value==expectedParts[part.Key]),"Stale system selection cannot partially overwrite modules");
var independent=store.Read("reset");store.Save("reset","default",independent.Revision,independent.ProfileRevision,"popups");
Check(store.Read("reset").Parts!["home"]=="orbit"&&store.Read("reset").Parts!["popups"]=="default","Individual override preserves remaining system modules");
Console.WriteLine($"PASS: {count} theme storage/catalog/package assertions (isolated SQLite fixture).");
