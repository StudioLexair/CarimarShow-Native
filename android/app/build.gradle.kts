plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.studiolexair.carimarshow"
    compileSdk = 35
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "com.studiolexair.carimarshow"
        minSdk = 24
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        versionCode = (System.getenv("APP_BUILD_NUMBER") ?: "1").toInt()
        versionName = "2.2.0"
    }
    signingConfigs {
        create("release") {
            val keyPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!keyPath.isNullOrBlank()) {
                storeFile = file(keyPath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (!System.getenv("ANDROID_KEYSTORE_PATH").isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
        }
    }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webassets"))
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
val copyWeb by tasks.registering(Sync::class) {
    from("../../public")
    into(layout.buildDirectory.dir("generated/webassets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:core:1.6.1")
    androidTestImplementation("androidx.test.espresso:espresso-intents:3.6.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}
