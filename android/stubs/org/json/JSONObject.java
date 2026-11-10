package org.json;
/** Заглушка только для компиляции (в APK не попадает). Сигнатуры совпадают с Android SDK. */
public class JSONObject {
    public JSONObject(String json) throws JSONException { throw new RuntimeException("stub"); }
    public String getString(String name) throws JSONException { throw new RuntimeException("stub"); }
    public String optString(String name, String fallback) { throw new RuntimeException("stub"); }
    public int optInt(String name, int fallback) { throw new RuntimeException("stub"); }
    public long optLong(String name, long fallback) { throw new RuntimeException("stub"); }
    public JSONObject optJSONObject(String name) { throw new RuntimeException("stub"); }
    public JSONArray getJSONArray(String name) throws JSONException { throw new RuntimeException("stub"); }
}
