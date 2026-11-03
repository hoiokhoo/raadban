package app.raadban.viewer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * رصد‌بان موبایل — پوستهٔ WebView برنامهٔ وب رصد‌بان
 * بار اول: کاربر نشانی سرور (مثل http://192.168.1.5:3000) را وارد می‌کند؛
 * بعد از آن همیشه مستقیم برنامه باز می‌شود. دکمهٔ ⚙ گوشهٔ پایین برای تغییر نشانی.
 */
public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "raadban";
    private static final String KEY_URL = "url";

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView web;
    private LinearLayout setup;
    private TextView setupError;
    private EditText urlInput;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        root = new FrameLayout(this);
        setContentView(root);

        buildWebView();
        buildSetupView();
        buildGearButton();

        String url = prefs.getString(KEY_URL, null);
        if (url == null || url.trim().isEmpty()) {
            url = getString(R.string.app_default_url).trim();
        }
        if (!url.isEmpty()) {
            open(url);
        } else {
            showSetup();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void buildWebView() {
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setAllowFileAccess(false);
        web.setBackgroundColor(Color.rgb(0xF8, 0xFA, 0xFC));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // همهٔ ناوبری داخل اپ می‌ماند
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this,
                            "اتصال به سرور نشد — نشانی یا شبکه را بررسی کنید (دکمهٔ ⚙ برای تغییر نشانی)",
                            Toast.LENGTH_LONG).show();
                }
            }
        });
        web.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void buildSetupView() {
        setup = new LinearLayout(this);
        setup.setOrientation(LinearLayout.VERTICAL);
        setup.setGravity(Gravity.CENTER);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        setup.setPadding(pad, pad, pad, pad);
        setup.setBackgroundColor(Color.rgb(0xF8, 0xFA, 0xFC));

        TextView title = new TextView(this);
        title.setText(R.string.setup_title);
        title.setTextSize(26);
        title.setTextColor(Color.rgb(0x0F, 0x76, 0x6E));
        title.setGravity(Gravity.CENTER);
        setup.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("سامانه هوشمند رصد و راستی‌آزمایی اخبار");
        subtitle.setTextSize(13);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sp.topMargin = (int) (6 * getResources().getDisplayMetrics().density);
        setup.addView(subtitle, sp);

        TextView hint = new TextView(this);
        hint.setText(R.string.setup_hint);
        hint.setTextSize(14);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hp.topMargin = (int) (28 * getResources().getDisplayMetrics().density);
        setup.addView(hint, hp);

        urlInput = new EditText(this);
        urlInput.setSingleLine(true);
        urlInput.setHint("http://");
        urlInput.setTextSize(16);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ip.topMargin = (int) (12 * getResources().getDisplayMetrics().density);
        setup.addView(urlInput, ip);

        Button connect = new Button(this);
        connect.setText(R.string.setup_button);
        connect.getBackground().setColorFilter(Color.rgb(0x0F, 0x76, 0x6E), android.graphics.PorterDuff.Mode.SRC_ATOP);
        connect.setTextColor(Color.WHITE);
        connect.setOnClickListener(v -> {
            String u = urlInput.getText().toString().trim();
            if (u.isEmpty()) {
                setupError.setVisibility(View.VISIBLE);
                return;
            }
            if (!u.startsWith("http://") && !u.startsWith("https://")) {
                u = "http://" + u;
            }
            if (!u.matches("^https?://.+")) {
                setupError.setVisibility(View.VISIBLE);
                return;
            }
            prefs.edit().putString(KEY_URL, u).apply();
            open(u);
        });
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.topMargin = (int) (16 * getResources().getDisplayMetrics().density);
        setup.addView(connect, bp);

        setupError = new TextView(this);
        setupError.setText(R.string.setup_error);
        setupError.setTextColor(Color.rgb(0xBE, 0x12, 0x3C));
        setupError.setVisibility(View.GONE);
        setupError.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams ep = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ep.topMargin = (int) (10 * getResources().getDisplayMetrics().density);
        setup.addView(setupError, ep);

        TextView note = new TextView(this);
        note.setText("سرور برنامه (رصد‌بان روی کامپیوتر یا سرور) باید روشن باشد؛ ربات خبررسان بله مستقل از این اپ در گیت‌هاب فعال است.");
        note.setTextSize(11);
        note.setTextColor(Color.rgb(0x94, 0xA3, 0xB8));
        note.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        np.topMargin = (int) (32 * getResources().getDisplayMetrics().density);
        setup.addView(note, np);

        setup.setVisibility(View.GONE);
        root.addView(setup, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void buildGearButton() {
        TextView gear = new TextView(this);
        gear.setText("⚙");
        gear.setTextSize(22);
        gear.setTextColor(Color.rgb(0x0F, 0x17, 0x2A));
        gear.setAlpha(0.35f);
        gear.setGravity(Gravity.CENTER);
        int size = (int) (44 * getResources().getDisplayMetrics().density);
        int margin = (int) (10 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams gp = new FrameLayout.LayoutParams(size, size);
        gp.gravity = Gravity.BOTTOM | Gravity.START;
        gp.setMargins(margin, margin, margin, margin);
        gear.setOnClickListener(v -> showSetup());
        root.addView(gear, gp);
    }

    private void showSetup() {
        String current = prefs.getString(KEY_URL, "");
        urlInput.setText(current);
        setupError.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
    }

    private void open(String url) {
        setup.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        web.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
