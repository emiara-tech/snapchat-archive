# Goodbye Chat

# Why
Snapchat today is not what it used to be. I am not who I used to be either. When I was 12 I though snapchat was great.

I took a lot of photos, made a lot of memories, talked with a lot of people, fell in love, fell out of love, made friends, made stupid faces. 

Now it is 13 years later and want to get off the yellow app, but keep my life memories. How can I even do that? Thankfully I remember GDPR! If I ask Snapchat they will have to give me my data. And they did...

Thanks Snapchat for following GDPR and respecting my data. Now this part is for respecting your life memories.

# How to use
1. Request zip files from Snapchat page [My Data](https://accounts.snapchat.com/v2/download-my-data)
2. Wait...
3. Download zip files from the email Snapchat sends you.
4. Navigate to goodbye.chat
5. Upload zip(locally, i.e. stays in your browser).
6. Reminisce.
7. Export
8. Move on!

# Features

## Data Analysis
snapchat-archive supports a modular and extensible way to analyse your snapchat archive in any way you want.

### Quantitative Analysis
1. Words: how many words? to who? what words? give me some graphs.
2. AI: Can I get an AI to talk like I used to talk on snapchat to my friends back in 2012? (Local LLM support coming)

### Chats
You would think being a chat based social media platform that they would know how to make one for their data review page. No, so this point is simply to do their job for them. AND, I want to see the pictures that were sent in the chat, with the chat.

### Images and Export
Photos are the most important part here. If you go to the memories tab of the index.html page that comes with your snapchat export you will see something like this:

Date	Media Type	Location
2026-03-21 09:12:33 UTC	Image	Latitude, Longitude: 59.91387, 10.75225
2026-03-22 18:47:05 UTC	Image	Latitude, Longitude: 60.16952, 11.35322
...
2026-03-27 02:44:26 UTC	Image	Latitude, Longitude: 61.50010, 23.76030
2026-03-28 12:10:58 UTC	Image	Latitude, Longitude: 60.25698, 9.21820

Along with [Download links that no longer work](https://www.youtube.com/watch?v=dQw4w9WgXcQ) after seven days. Even though the photos in question are part of the zip file.

Snapchat-archive will let you browse ALL your photos in one place.
Not only memories. The UI should let you filter based on snapchat users, dates, and have a view for only memories.

It should also include a Map View. Basic stuff.

The prime focus is filtering and then exporting to other services like Google Photos, Lightroom, and of course Immich. 


# Technical Challenges

1. Linking up photos from the `chat_media` directory of the archive to the metadata in `json/snap_history.json` and `json/chat_history.json`.
2. Joining chat photos with the text, stickers and drawings on them, as these are stored as separate image files.
