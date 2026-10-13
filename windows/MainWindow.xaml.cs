using System.Diagnostics;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace CarimarShow;
public partial class MainWindow : Window {
    const string Host = "carimarshow.local";
    public MainWindow() { InitializeComponent(); Loaded += async (_, _) => {
        try {
            var data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StudioLexair", "CarimarShow", "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, data);
            await Browser.EnsureCoreWebView2Async(env);
            var core = Browser.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping(Host, Path.Combine(AppContext.BaseDirectory, "web"), CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsWebMessageEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.NavigationStarting += (_, e) => { if (!IsLocal(e.Uri)) { e.Cancel = true; OpenExternal(e.Uri); } };
            core.NewWindowRequested += (_, e) => { e.Handled = true; if (e.IsUserInitiated) OpenExternal(e.Uri); };
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) => {
                if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri)) return;
                if (uri.Scheme is "data" or "blob" or "about") return;
                if (uri.Scheme == "https" && (uri.Host == Host || uri.Host == "carimarshow-native.vercel.app" || uri.Host == "image.tmdb.org")) return;
                e.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(), 403, "Blocked", "Content-Type: text/plain");
            };
            core.Navigate($"https://{Host}/app/index.html#home");
        } catch (Exception ex) {
            MessageBox.Show("No se pudo iniciar CarimarShow. Instala Microsoft Edge WebView2 Runtime o vuelve a ejecutar el instalador completo.\n\n"+ex.Message, "CarimarShow", MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
        }
    }; }
    static bool IsLocal(string url) => Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Scheme == "https" && u.Host == Host;
    static void OpenExternal(string url) {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || !(u.Scheme is "https" or "http" or "mailto" or "tel")) return;
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    }
}
