package com.albaneloh.iptv.player

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.albaneloh.iptv.R
import com.albaneloh.iptv.model.ChannelItem

class ChannelAdapter(
    private var items: List<ChannelItem>,
    private val onClick: (Int) -> Unit
) : RecyclerView.Adapter<ChannelAdapter.ChannelViewHolder>() {

    private var currentIndex: Int = 0

    class ChannelViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val row: LinearLayout = view.findViewById(R.id.channelRow)
        val number: TextView = view.findViewById(R.id.textChannelNumber)
        val name: TextView = view.findViewById(R.id.textChannelName)
        val group: TextView = view.findViewById(R.id.textChannelGroupItem)
        val playing: TextView = view.findViewById(R.id.textNowPlaying)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChannelViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_channel, parent, false)
        return ChannelViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChannelViewHolder, position: Int) {
        val item = items[position]
        holder.number.text = (position + 1).toString()
        holder.name.text = item.name
        holder.group.text = item.group
        holder.group.visibility = if (item.group.isBlank()) View.GONE else View.VISIBLE
        holder.playing.visibility = if (position == currentIndex) View.VISIBLE else View.GONE
        holder.name.setTextColor(if (position == currentIndex) 0xFFE50914.toInt() else 0xFFFFFFFF.toInt())
        holder.row.setOnClickListener { onClick(holder.bindingAdapterPosition) }
    }

    override fun getItemCount(): Int = items.size

    fun updateCurrent(index: Int) {
        val previous = currentIndex
        currentIndex = index
        if (previous in items.indices) notifyItemChanged(previous)
        if (index in items.indices) notifyItemChanged(index)
    }

    fun submit(list: List<ChannelItem>) {
        items = list
        notifyDataSetChanged()
    }
}
