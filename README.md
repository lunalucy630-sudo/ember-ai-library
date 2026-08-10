# Ember

AI Video Library App



I want you to build a premium AI-powered digital library centered around videos. This is not a note-taking app or cloud storage service. The purpose is to create a personal knowledge library where AI understands everything I save.



The app should use an existing multimodal AI model, preferably the OpenAI API (ChatGPT), instead of creating a new AI model from scratch.



Primary Focus: Videos



Videos are the heart of the application.



Approximately 85% of the content users save will be videos, while the remaining 15% will be documents and other files.



The app should prioritize uploading and organizing:



MP4, MOV, AVI, and other video files



Screen recordings



Lecture recordings



Tutorials



Recipe videos



Educational videos



Meeting recordings



TikTok videos



Instagram Reels



YouTube videos and Shorts





Users should be able to either upload the video directly or, when possible, paste a link so the app can import it automatically.



Secondary Content



The app should also support:



PDF files



Word documents



PowerPoint presentations



Images



Audio recordings



Notes



Website links





These should receive the same AI analysis but are secondary to videos.



AI Video Understanding



When a video is uploaded or imported, the AI should automatically:



Watch the entire video.



Generate a full transcript.



Recognize text displayed on screen (OCR).



Understand what is happening visually, not just what is being said.



Detect demonstrations, objects, recipes, presentations, diagrams, and important scenes.



Generate a short summary.



Generate a detailed summary.



Extract key ideas and actionable advice.



Identify important timestamps.



Generate searchable keywords and tags.



Recommend categories automatically.



Keep the original video playable inside the app.





AI Document Understanding



For documents, the AI should:



Read the complete document.



Summarize it.



Extract important information.



Generate searchable keywords.



Detect themes and topics.



Make the content searchable.





Digital Library



I don't want a traditional folder system.



I want an elegant digital library where every item can belong to multiple collections without duplication.



Example collections:



Recipes



Leadership



Psychology



Social Work



University



AI



Productivity



Finance



Health



Interior Design



Books



Travel



DIY



Business





The AI should automatically suggest collections while allowing users to create unlimited custom collections.



AI Chat Assistant



Include an AI assistant connected to the user's library.



Users should be able to ask questions like:



"Find every video about leadership."



"Show me the TikTok recipe using chicken."



"Summarize all my saved lectures."



"Compare these two presentations."



"Find every resource about communication skills."



"What have I saved about psychology?"





The AI should answer using only the user's saved content unless the user explicitly asks it to search the web.



Search



Search should understand natural language instead of relying only on keywords.



Examples:



"Find the recipe video with pasta."



"Show me the lecture about child development."



"Find the document mentioning empathy."



"Show videos explaining active listening."





User Interface



The design should feel elegant, feminine, and premium.



Use this color palette:



Soft Ivory (#F8F4F4)



Blush White (#F4E7E7)



Powder Pink (#F6D8D8)



Rose Blush (#F8C2C2)



Warm Coral Pink (#F99EA1)





The interface should include:



Rounded corners



Soft shadows



Glassmorphism where appropriate



Smooth animations



Minimalist layouts



Beautiful typography



Elegant icons



A cozy "personal library" atmosphere





The experience should feel like browsing a luxurious digital bookshelf rather than a productivity app.



Goal



The goal is to create an AI-powered video-first knowledge library that remembers and understands everything users save. Instead of simply storing files, it should analyze videos and documents, organize them intelligently, make them searchable, and allow users to chat with their own personal knowledge base. The app should make it effortless to revisit, search, and learn from any saved content months or years later.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ember-ai-library.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9c09da0-5f09-4b46-98cd-f2c704c73eb1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
