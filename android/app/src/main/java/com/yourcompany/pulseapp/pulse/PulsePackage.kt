// android/app/src/main/java/com/yourcompany/pulseapp/pulse/PulsePackage.kt
package com.yourcompany.pulseapp.pulse

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PulsePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            PulseModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        // we don't expose any native views yet
        return emptyList()
    }
}
