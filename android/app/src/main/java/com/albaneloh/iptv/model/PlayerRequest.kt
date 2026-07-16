package com.albaneloh.iptv.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import org.json.JSONObject

@Parcelize
data class PlayerRequest(
    val url: String,
    val title: String,
    val channelName: String,
    val channelGroup: String = "",
    val streamType: String = "",
    val headers: Map<String, String> = emptyMap(),
    val cookie: String? = null
) : Parcelable {

    companion object {
        fun fromJson(json: String): PlayerRequest {
            val root = JSONObject(json)
            val headersJson = root.optJSONObject("headers")
            val headers = linkedMapOf<String, String>()

            if (headersJson != null) {
                val keys = headersJson.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = headersJson.optString(key)
                    if (value.isNotBlank()) {
                        headers[key] = value
                    }
                }
            }

            val title = root.optString("title").ifBlank { root.optString("channelName", "Chaîne") }
            val name = root.optString("channelName").ifBlank { title }
            val group = root.optString("channelGroup")
            val streamType = root.optString("type")
            val cookie = root.optString("cookie").ifBlank { headers["Cookie"] }

            return PlayerRequest(
                url = root.getString("url"),
                title = title,
                channelName = name,
                channelGroup = group,
                streamType = streamType,
                headers = headers,
                cookie = cookie
            )
        }
    }
}
