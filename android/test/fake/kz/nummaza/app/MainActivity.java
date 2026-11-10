package kz.nummaza.app;
public class MainActivity { static String json(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; } }
