using System.Windows;

namespace Doorpi
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            DoorpiBootDiagnostics.Log("app-onstartup");

            if (DoorpiBootDiagnostics.ShouldAbortCurrentSession(out string reason))
            {
                DoorpiBootDiagnostics.Log("app-abort", reason);
                Shutdown();
                return;
            }

            base.OnStartup(e);
        }
    }
}
