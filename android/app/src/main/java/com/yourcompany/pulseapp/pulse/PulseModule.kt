// android/app/src/main/java/com/yourcompany/pulseapp/pulse/PulseModule.kt
package com.yourcompany.pulseapp.pulse

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PulseModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        // This is the name JS will use: NativeModules.PulseModule
        return "PulseModule"
    }

    @ReactMethod
    fun getTestBpm(promise: Promise) {
        // Super dumb test: always return 72
        promise.resolve(72)
    }
}
