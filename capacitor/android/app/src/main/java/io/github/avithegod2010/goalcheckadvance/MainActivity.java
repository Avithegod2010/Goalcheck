package io.github.avithegod2010.goalcheckadvance;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // GC-NATIVE-GLUE — local plugin registration (re-injected by scripts/native-glue.mjs).
    // registerPlugin must run BEFORE super.onCreate so the bridge loads GoalCheckNative.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoalCheckNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // GC-NATIVE-GLUE — ACTION_SEND shares and quick-settings tile launches are bridged
    // to the web layer as GoalCheckNative events ("shareText" {text} / "quickAdd" {}).
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        GoalCheckNativePlugin.emitIntent(this, intent);
    }
}
