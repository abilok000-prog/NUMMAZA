package android.webkit;
public class WebResourceResponse {
    public final String mime, enc; public final java.io.InputStream data;
    public WebResourceResponse(String m, String e, java.io.InputStream d) { mime = m; enc = e; data = d; }
}
