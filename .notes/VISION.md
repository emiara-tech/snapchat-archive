---
title: Goodbye Chat
author: Emilio Andrés Heiberg Aranda
date: 2026-06-11
---

# Goodbye Chat

## Why

Snapchat today is not what it used to be. I am not who I used to be either. When I was 12 I thought Snapchat was great. I took a lot of photos, made a lot of memories, talked with a lot of people, fell in love, fell out of love, made friends, made stupid faces.

Now it is 13 years later and I want to get off the yellow app, but keep my life memories. How can I even do that? Thankfully I remember GDPR. If I ask Snapchat they will have to give me my data. And they did.

Thanks Snapchat for following GDPR and respecting my data. Now this part is for respecting your life memories.

For everyone who has had the thought: *wait, do I really want to keep using this app for my most personal digital interactions my whole life?* — this is for you.

## The Tension at the Heart of the Product

Growing up on social media means slowly realising you were the product. The memories you made are held hostage by a platform you no longer trust, in an app you no longer recognise, owned by a company whose interests are not yours. Goodbye Chat exists to dissolve that hold and put you back in control of your own past.

The application is by its nature private. All computation is done locally. Opening up your archive should feel like opening a personal memories box that you buried in the yard when you were 8 — magical for you, and only you.

## Who This Is For

Anyone who used social media during their teenage years and has a camera roll full of screenshots instead of the moments themselves. Within that, three overlapping people:

- **The Escapee** — just wants their data out, cleanly, with a clear path to somewhere they trust (Immich, Google Photos, local storage).
- **The Eulogist** — wants to reminisce before leaving. The goodbye is a ritual, and the ritual is the point. They need the proper goodbye to be able to leave.
- **The Curious** — wants insight into their own digital life and may never leave Snapchat at all. The goodbye is optional, but the reflection is not.

The product invites all three in. It does not gate the reminiscing behind a commitment to leave, and it does not gate the export behind a commitment to reminisce. It does, however, push a point of view: your memories should belong to you, and there is a better place for them than in the hands of a giant tech company.

## Insight: Understanding the Grand Story of Your Digital Life

The application supplies your textual, photographic, and metadata life on Snapchat in a form factor shaped by how you remember it, not by how the underlying data is structured. Memories are multimodal, so the interface is multimodal. Reminiscing is non-linear, so the navigation is non-linear. Quick shifts of focus from a photo, to a word cloud of that same era, to a chat from the same week should feel snappy and free-flowing.

The north star is *Social Media Wrapped*. The moment the product is worth it is the moment you see a memory you had completely forgotten — a heated argument from years ago, a yoloswag comment that makes you cringe, a friend you have not thought about in a decade — and feel both the scale of your life on this app and the intimacy of a single recovered moment, at the same time.

## The Intended Flow

The full page-by-page arc — from arrival through export and further reading — is documented in [FLOW.md](./FLOW.md). The product has two endings on purpose. The emotional ending — *your memories are yours, you are free to leave* — speaks to the Eulogist and the Escapee. The intellectual ending — *here is what was being done to you* — speaks to the Curious, who may need that argument to act on anything at all.

## LLM Feature

You can load a year into an LLM and chat with your memories, or ask for a summary of 2014. As of June  11th 2026 that contradicts the values of the application.

The bet is that local LLMs are about to become good enough to run this feature on-device. Apple's announcement that small developers get free access to Foundation Models on Private Cloud Compute is one signal that the infrastructure is catching up to the principle. Until it does, the feature confronts the user with a real question: *do you want to send your teenage chats to a cloud model?* 

If local models arrive, this becomes the centrepiece. If they do not, the question itself still serves the product's values.

## Principles
- **Local-first, always.** Nothing about reminiscing or exporting should require a remote service. Where remote compute is unavoidable, the user makes the choice with full awareness.
- **Multimodal because memory is multimodal.** Text, image, and metadata views should connect, not silo.
- **Snappy because memory is associative.** Switching contexts must be near-instant or the spell breaks.
- **Opinionated, not coercive.** The product believes you should leave, and says so. It does not force you to.
- **Made by me, for me, shared with you.** This is a personal project with a personal point of view, offered openly to anyone who shares the discomfort that motivated it.
