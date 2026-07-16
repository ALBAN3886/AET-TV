package com.albaneloh.iptv

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Capture les crashs (exceptions non interceptées) et les écrit dans un fichier
 * local, afin qu'ils puissent être lus au prochain lancement de l'app,
 * sans avoir besoin d'adb / logcat / PC.
 */
object CrashLogger {
    private const val FILE_NAME = "last_crash.txt"

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                File(appContext.filesDir, FILE_NAME).writeText(sw.toString())
            } catch (_: Throwable) {
                // Rien à faire si l'écriture du crash échoue elle-même.
            }

            if (previousHandler != null) {
                previousHandler.uncaughtException(thread, throwable)
            } else {
                android.os.Process.killProcess(android.os.Process.myPid())
                kotlin.system.exitProcess(1)
            }
        }
    }

    /** Retourne le dernier crash enregistré (et le supprime), ou null s'il n'y en a pas. */
    fun readLastCrashAndClear(context: Context): String? {
        val file = File(context.applicationContext.filesDir, FILE_NAME)
        if (!file.exists()) return null
        val content = file.readText()
        file.delete()
        return content
    }
}
