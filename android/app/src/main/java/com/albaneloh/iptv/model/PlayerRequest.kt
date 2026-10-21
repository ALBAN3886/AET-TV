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
    val cookie: String? = null,
    val channels: List<ChannelItem> = emptyList(),
    val channelIndex: Int = 0
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

            val channelsJson = root.optJSONArray("channels")
            val channels = mutableListOf<ChannelItem>()
            if (channelsJson != null) {
                for (i in 0 until channelsJson.length()) {
                    val c = channelsJson.optJSONObject(i) ?: continue
                    val channelUrl = c.optString("url")
                    if (channelUrl.isBlank()) continue
                    channels.add(
                        ChannelItem(
                            url = channelUrl,
                            name = c.optString("name").ifBlank { "Chaine" },
                            group = c.optString("group"),
                            logo = c.optString("logo"),
                            userAgent = c.optString("userAgent"),
                            referer = c.optString("referer")
                        )
                    )
                }
            }

            return PlayerRequest(
                url = root.getString("url"),
                title = title,
                channelName = name,
                channelGroup = group,
                streamType = streamType,
                headers = headers,
                cookie = cookie,
                channels = channels,
                channelIndex = root.optInt("index", 0)
            )
        }
    }
}

@Parcelize
data class ChannelItem(
    val url: String,
    val name: String,
    val group: String = "",
    val logo: String = "",
    val userAgent: String = "",
    val referer: String = ""
) : Parcelable
