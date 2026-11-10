package android.content.res;
import java.io.*;
public final class AssetManager {
    public static File dir;
    public InputStream open(String name) throws IOException { return new FileInputStream(new File(dir, name)); }
}
