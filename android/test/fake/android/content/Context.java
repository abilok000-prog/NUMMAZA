package android.content;
import java.io.File;
import java.util.HashMap;
import java.util.Map;
public abstract class Context {
    public static final int MODE_PRIVATE = 0;
    public static File filesDir;
    public static final Map<String, String> PREFS = new HashMap<>();
    public SharedPreferences getSharedPreferences(String name, int mode) {
        return new SharedPreferences() {
            public String getString(String k, String d) { synchronized (PREFS) { String v = PREFS.get(k); return v == null ? d : v; } }
            public Editor edit() {
                final Map<String, String> pend = new HashMap<>();
                return new Editor() {
                    public Editor putString(String k, String v) { pend.put(k, v); return this; }
                    public void apply() { synchronized (PREFS) { PREFS.putAll(pend); } }
                    public boolean commit() { apply(); return true; }
                };
            }
        };
    }
    public File getFilesDir() { return filesDir; }
    public android.content.res.AssetManager getAssets() { return new android.content.res.AssetManager(); }
}
