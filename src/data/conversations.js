export const allConversationData = [
    // ========== Use Case I-1: Kevin - Day 0 Activation ==========
    {
        id: 1,
        name: "Kevin",
        title: "Day 0 - Activation & The Hook",
        avatar: { bg: "#3b82f6", initials: "KV" },
        statusBadge: "active",
        day: 0,
        preview: "Pattern interrupt activation...",
        steps: [
            {
                type: "kira",
                content: "Hey Kevin! Chris Chan here. Hope all is well? Love to quickly check something with you now, convenient?",
                time: "10:05 AM",
                options: [
                    { text: "Yes, what's up?", type: "positive" },
                    { text: "Not now, busy", type: "negative" },
                    { text: "Who is this? / What's this about?", type: "neutral" }
                ]
            },
            // Branch 1: "Yes, what's up?" → Snooker Metaphor
            {
                trigger: "Yes, what's up?",
                type: "kira",
                content: "Chris here... I've been watching how the top 1% set themselves up for next year. It's like Snooker — they aren't just playing the current shot; they are already lining up the next three. Curious — looking at your business right now, how's your momentum for the 'next shot'?",
                time: "10:07 AM",
                options: [
                    { text: "Going okay, but tired", type: "neutral" },
                    { text: "Pretty good actually", type: "positive" },
                    { text: "Struggling honestly", type: "negative" }
                ]
            },
            {
                trigger: "Going okay, but tired",
                type: "kira",
                content: "Totally get that. December fatigue is real. Would you like me to share a quick 2-minute Reflection Checklist to review your final sprint goals before we plan Q1?",
                time: "10:11 AM",
                options: [
                    { text: "Yes please", type: "positive" },
                    { text: "Maybe later", type: "negative" }
                ]
            },
            {
                trigger: "Yes please",
                type: "system",
                content: "✓ Checklist link sent. User tagged: Interested_FinalSprint2025. Moved to Day 3 Active Queue.",
                time: "10:12 AM"
            },
            {
                trigger: "Maybe later",
                type: "kira",
                content: "No worries. I'll check back with you in a few days. Take care!",
                time: "10:12 AM"
            },
            {
                trigger: "Maybe later",
                type: "system",
                content: "⏱️ User tagged: Warm_Lead. 3-day timer set for follow-up.",
                time: "10:12 AM"
            },
            {
                trigger: "Pretty good actually",
                type: "kira",
                content: "Love to hear it! Since you're already moving forward, want to accelerate? I've got a Final Sprint Momentum Clinic coming up. Interested?",
                time: "10:11 AM",
                options: [
                    { text: "Tell me more", type: "positive" },
                    { text: "Not now", type: "negative" }
                ]
            },
            {
                trigger: "Tell me more",
                type: "kira",
                content: "It's a 90-min intensive where we map your 2026 trajectory. Free for alumni. Shall I send the details?",
                time: "10:13 AM",
                options: [
                    { text: "Yes, send it", type: "positive" },
                    { text: "I'll think about it", type: "neutral" }
                ]
            },
            {
                trigger: "Struggling honestly",
                type: "kira",
                content: "Appreciate the honesty. You're not alone — Q4 is tough. Want a quick strategy call to help you finish strong?",
                time: "10:11 AM",
                options: [
                    { text: "Yes, that would help", type: "positive" },
                    { text: "No, I'm good", type: "negative" }
                ]
            },
            {
                trigger: "Yes, that would help",
                type: "system",
                content: "✓ Strategy call link sent. User tagged: Struggling_NeedsSupport, High_Priority.",
                time: "10:13 AM"
            },
            {
                trigger: "No, I'm good",
                type: "kira",
                content: "Understood. If things change, I'm here. Wishing you a strong finish.",
                time: "10:13 AM"
            },
            // Branch 2: "Not now, busy"
            {
                trigger: "Not now, busy",
                type: "kira",
                content: "No worries at all. Just wanted to drop a quick 'Snooker Strategy' reflection for your end-of-year sprint. Shall I text the link so you can check it later?",
                time: "10:08 AM",
                options: [
                    { text: "Yes, send it", type: "positive" },
                    { text: "Not interested", type: "negative" }
                ]
            },
            {
                trigger: "Yes, send it",
                type: "system",
                content: "✓ Link sent. User tagged: Interested_FinalSprint2025. Will follow up in Day 3.",
                time: "10:09 AM"
            },
            {
                trigger: "Not interested",
                type: "kira",
                content: "Got it. Thanks for your time. If anything changes, feel free to reach out.",
                time: "10:09 AM"
            },
            {
                trigger: "Not interested",
                type: "system",
                content: "✓ User tagged: Low_Interest. Paused for 30 days.",
                time: "10:09 AM"
            },
            // Branch 3: "Who is this?"
            {
                trigger: "Who is this? / What's this about?",
                type: "kira",
                content: "Apologies, it's Chris Chan (PPP Academy). Updating my contacts and wanted to see how your Q4 momentum is holding up. Good time to chat?",
                time: "10:08 AM",
                options: [
                    { text: "Yes, what's up?", type: "positive" },
                    { text: "Not now", type: "negative" }
                ]
            },
            {
                trigger: "Not now",
                type: "kira",
                content: "No problem. I'll reach out again in the new year. Happy holidays!",
                time: "10:10 AM"
            },
            {
                trigger: "Not now",
                type: "system",
                content: "✓ User tagged: Identity_Clarified. Follow up in January 2026.",
                time: "10:10 AM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Kevin! Chris Chan here. Hope all is well? Love to quickly check something with you now, convenient?", time: "10:05 AM" },
            { type: "user", content: "Yes, what's up?", time: "10:06 AM" },
            { type: "kira", content: "Chris here... I've been watching how the top 1% set themselves up for next year. It's like Snooker — they aren't just playing the current shot; they are already lining up the next three. Curious — looking at your business right now, how's your momentum for the 'next shot'?", time: "10:07 AM" },
            { type: "user", content: "Going okay, but tired.", time: "10:10 AM" },
            { type: "kira", content: "Totally get that. December fatigue is real. Would you like me to share a quick 2-minute Reflection Checklist to review your final sprint goals before we plan Q1?", time: "10:11 AM" },
            { type: "user", content: "Yes please.", time: "10:12 AM" },
            { type: "system", content: "✓ Checklist link sent. User tagged: Interested_FinalSprint2025. Moved to Day 3 Active Queue.", time: "10:12 AM" }
        ],
        tags: [
            { name: "Interested_FinalSprint2025", type: "status", icon: "📊", tooltip: { title: "Interested in Final Sprint 2025", description: "User explicitly requested value content during Day 0 engagement." } },
            { name: "Active_Dialogue", type: "engage", icon: "💬", tooltip: { title: "Active in Conversation", description: "User is responding positively and engaging." } },
            { name: "LowEnergy", type: "intent", icon: "😴", tooltip: { title: "Low Energy State", description: "User expressed fatigue. Sales approach should emphasize empathy." } }
        ],
        logs: [
            { time: "10:06 AM", title: "Intent Analysis", detail: "User responded positively - POSITIVE intent detected" },
            { time: "10:10 AM", title: "Intent Analysis", detail: "Low energy state detected - applying empathy strategy" },
            { time: "10:12 AM", title: "Tag Applied", detail: "Applied [STATUS]: Interested_FinalSprint2025" },
            { time: "10:12 AM", title: "Queue Movement", detail: "Moved to Day 3 Active Queue" }
        ],
        currentStatus: { intent: "POSITIVE", nextAction: "Day 3 Webinar Invite", queue: "Day 3 Active Queue" }
    },

    // ========== Use Case I-2: Tom - Day 3 & 7 Soft Objection ==========
    {
        id: 2,
        name: "Tom",
        title: "Day 3 & 7 - Soft Objection & Busy Loop",
        avatar: { bg: "#8b5cf6", initials: "TM" },
        statusBadge: "active",
        day: "3-7",
        preview: "4-day persistence loop...",
        steps: [
            // Day 3 Initial Contact
            {
                type: "kira",
                content: "Hey Tom, just checking — would you like me to send you an invite to our private Final Sprint Momentum Clinic this week?",
                time: "Day 3, 2:30 PM",
                options: [
                    { text: "Yes, send the invite", type: "positive" },
                    { text: "Not now, too busy", type: "negative" },
                    { text: "Is it recorded? / Can I watch later?", type: "neutral" }
                ]
            },
            // Branch 1: "Yes, send the invite"
            {
                trigger: "Yes, send the invite",
                type: "kira",
                content: "Great! Here's your exclusive invite link: [Link]. See you there!",
                time: "Day 3, 2:35 PM"
            },
            {
                trigger: "Yes, send the invite",
                type: "system",
                content: "✓ Registration link sent. User tagged: Webinar_Reg. Calendar invite sent.",
                time: "Day 3, 2:35 PM"
            },
            // Branch 2: "Not now, too busy" → Triggers Day 7
            {
                trigger: "Not now, too busy",
                type: "kira",
                content: "No worries at all. I'll circle back when things settle.",
                time: "Day 3, 2:35 PM"
            },
            {
                trigger: "Not now, too busy",
                type: "system",
                content: "⏱️ Soft objection detected. User tagged: Warm_Lead. 4-day timer started for automatic follow-up.",
                time: "Day 3, 2:35 PM"
            },
            // Branch 3: "Is it recorded?"
            {
                trigger: "Is it recorded? / Can I watch later?",
                type: "kira",
                content: "We prioritize live interaction for best results. But register anyway — if we do release a recap, you'll be first on the list. Shall I send the link?",
                time: "Day 3, 2:35 PM",
                options: [
                    { text: "Yes, send it", type: "positive" },
                    { text: "No thanks", type: "negative" }
                ]
            },
            {
                trigger: "Yes, send it",
                type: "system",
                content: "✓ Registration link sent. User tagged: Webinar_Reg (Recording Interest).",
                time: "Day 3, 2:37 PM"
            },
            {
                trigger: "No thanks",
                type: "kira",
                content: "Understood. If you change your mind, the offer stands. Have a great week!",
                time: "Day 3, 2:37 PM"
            },
            {
                trigger: "No thanks",
                type: "system",
                content: "✓ User declined. Tagged: Followup_Jan_2026.",
                time: "Day 3, 2:37 PM"
            },
            // Day 7 Follow-up (triggered by "Not now, too busy")
            {
                trigger: "Not now, too busy",
                type: "kira",
                content: "Hey Tom, quick reminder — that Final Sprint Clinic goes live soon. Still want me to keep a seat for you? Or should I give it to someone else?",
                time: "Day 7, 10:05 AM",
                options: [
                    { text: "Yes, keep it!", type: "positive" },
                    { text: "Give it to someone else", type: "negative" },
                    { text: "I'll think about it", type: "neutral" }
                ]
            },
            {
                trigger: "Yes, keep it!",
                type: "kira",
                content: "Perfect. Your spot is saved. Link coming right up: [Link]",
                time: "Day 7, 10:08 AM"
            },
            {
                trigger: "Yes, keep it!",
                type: "system",
                content: "✓ Registration link sent. User tagged: Webinar_Reg, Recovered_Lead.",
                time: "Day 7, 10:08 AM"
            },
            {
                trigger: "Give it to someone else",
                type: "kira",
                content: "Got it. If you change your mind, the door is always open. Wishing you a strong finish to the year.",
                time: "Day 7, 10:08 AM"
            },
            {
                trigger: "Give it to someone else",
                type: "system",
                content: "✓ User declined. Tagged: Followup_Jan_2026. Campaign paused.",
                time: "Day 7, 10:08 AM"
            },
            {
                trigger: "I'll think about it",
                type: "kira",
                content: "Totally understand. Thinking is good — but don't let it become stalling. December is your launchpad. Want me to send a quick summary?",
                time: "Day 7, 10:08 AM",
                options: [
                    { text: "Yes, send summary", type: "positive" },
                    { text: "No, I'm good", type: "negative" }
                ]
            },
            {
                trigger: "Yes, send summary",
                type: "system",
                content: "✓ Summary PDF sent. User tagged: Hesitation_Followup.",
                time: "Day 7, 10:10 AM"
            },
            {
                trigger: "No, I'm good",
                type: "kira",
                content: "Alright. Best of luck with the sprint. We'll reconnect in the new year.",
                time: "Day 7, 10:10 AM"
            },
            {
                trigger: "No, I'm good",
                type: "system",
                content: "✓ User declined multiple times. Tagged: Followup_Feb_2026.",
                time: "Day 7, 10:10 AM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Tom, just checking — would you like me to send you an invite to our private Final Sprint Momentum Clinic this week?", time: "Day 3, 2:30 PM" },
            { type: "user", content: "Not now, too busy.", time: "Day 3, 2:45 PM" },
            { type: "kira", content: "No worries at all. I'll circle back when things settle.", time: "Day 3, 2:45 PM" },
            { type: "system", content: "⏱️ Soft objection detected. User tagged: Warm_Lead. 4-day timer started.", time: "Day 3, 2:45 PM" },
            { type: "kira", content: "Hey Tom, quick reminder — that Final Sprint Clinic goes live soon. Still want me to keep a seat for you? Or should I give it to someone else?", time: "Day 7, 10:05 AM" },
            { type: "user", content: "Yes, keep it!", time: "Day 7, 10:08 AM" },
            { type: "kira", content: "Perfect. Your spot is saved. Link coming right up: [Link]", time: "Day 7, 10:08 AM" },
            { type: "system", content: "✓ Registration link sent. User tagged: Webinar_Reg, Recovered_Lead.", time: "Day 7, 10:08 AM" }
        ],
        tags: [
            { name: "Warm_Lead", type: "status", icon: "🔥", tooltip: { title: "Warm Lead - Timing Conflict", description: "User expressed temporary unavailability. System will re-engage after 4-day wait with scarcity reminder." } },
            { name: "Recovered_Lead", type: "status", icon: "🔄", tooltip: { title: "Successfully Recovered Lead", description: "User converted after initial soft objection. High-value lead showing persistence." } }
        ],
        logs: [
            { time: "Day 3, 2:45 PM", title: "Intent Analysis", detail: "Soft objection detected - User cited timing/busy as barrier" },
            { time: "Day 3, 2:45 PM", title: "Timer Started", detail: "4-day wait period initiated before re-engagement" },
            { time: "Day 7, 10:08 AM", title: "Conversion Success", detail: "User converted after persistence - Recovered Lead" }
        ],
        currentStatus: { intent: "POSITIVE - Recovered", nextAction: "Day 14 Event Reminder", queue: "Webinar Confirmed" }
    },

    // ========== Use Case I-3: Sarah - Day 7 Hard Rejection ==========
    {
        id: 3,
        name: "Sarah",
        title: "Day 7 - Hard Rejection Processing",
        avatar: { bg: "#ef4444", initials: "SJ" },
        statusBadge: "completed",
        day: 7,
        preview: "Compliance & opt-out...",
        steps: [
            {
                type: "kira",
                content: "Hey Sarah, quick reminder — that Final Sprint Clinic goes live soon. Still want me to keep a seat for you?",
                time: "11:30 AM",
                options: [
                    { text: "Not interested at all", type: "negative" },
                    { text: "I'm travelling until Feb", type: "neutral" },
                    { text: "Stop texting me", type: "negative" }
                ]
            },
            // Branch 1: Hard rejection
            {
                trigger: "Not interested at all",
                type: "kira",
                content: "Respect that. Thanks for the honesty. Wishing you all the best.",
                time: "11:35 AM"
            },
            {
                trigger: "Not interested at all",
                type: "system",
                content: "⚠️ Hard rejection detected. User tagged: Do_Not_Contact. Global unsubscribe initiated.",
                time: "11:35 AM"
            },
            // Branch 2: Logistical delay
            {
                trigger: "I'm travelling until Feb",
                type: "kira",
                content: "Safe travels! I'll reconnect in early Feb to see if the timing works better then.",
                time: "11:35 AM"
            },
            {
                trigger: "I'm travelling until Feb",
                type: "system",
                content: "✓ User tagged: Followup_Feb_2026. Current campaign paused.",
                time: "11:35 AM"
            },
            // Branch 3: Explicit opt-out
            {
                trigger: "Stop texting me",
                type: "kira",
                content: "Understood. Apologies for the intrusion. I've removed you from this list. Take care.",
                time: "11:35 AM"
            },
            {
                trigger: "Stop texting me",
                type: "system",
                content: "⚠️ Unsubscribe request detected. All communications halted. Added to global suppression list.",
                time: "11:35 AM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Sarah, quick reminder — that Final Sprint Clinic goes live soon. Still want me to keep a seat for you?", time: "11:30 AM" },
            { type: "user", content: "Stop texting me. Not interested.", time: "11:35 AM" },
            { type: "kira", content: "Understood. Apologies for the intrusion. I've removed you from this list. Take care.", time: "11:35 AM" },
            { type: "system", content: "⚠️ Unsubscribe request detected. All communications halted. Added to global suppression list.", time: "11:35 AM" }
        ],
        tags: [
            { name: "Do_Not_Contact", type: "status", icon: "🚫", tooltip: { title: "Global Do Not Contact", description: "User exercised right to opt-out. Immediate cessation of all contact required." } },
            { name: "Hard_Rejection", type: "intent", icon: "❌", tooltip: { title: "Hard Rejection Intent", description: "User has zero interest. Relationship terminated. Critical for data hygiene." } }
        ],
        logs: [
            { time: "11:35 AM", title: "Intent Analysis", detail: "Hard rejection with explicit opt-out keywords detected" },
            { time: "11:35 AM", title: "Global Unsubscribe", detail: "Added to suppression list. Removed from all workflows." }
        ],
        currentStatus: { intent: "HARD_REJECTION", nextAction: "None - Permanently Opted Out", queue: "Suppression List" }
    },

    // ========== Use Case I-4: Alex - Day 10 Voice AI ==========
    {
        id: 4,
        name: "Alex",
        title: "Day 10 - Voice AI Emotional Breakthrough",
        avatar: { bg: "#10b981", initials: "AR" },
        statusBadge: "active",
        day: 10,
        preview: "Emotional voice connection...",
        steps: [
            {
                type: "kira",
                content: "Hey Alex! The Final Sprint Momentum Clinic is happening this week. We've saved a spot for you — are you in a position to join us?",
                time: "11:40 AM",
                options: [
                    { text: "Yes, I'm in", type: "positive" },
                    { text: "I'll think about it", type: "neutral" },
                    { text: "Not sure / Maybe later", type: "neutral" }
                ]
            },
            // Branch 1: Direct confirmation
            {
                trigger: "Yes, I'm in",
                type: "kira",
                content: "Awesome! Your spot is confirmed. Link sent: [Link]. See you inside!",
                time: "11:42 AM"
            },
            {
                trigger: "Yes, I'm in",
                type: "system",
                content: "✓ User confirmed. Tagged: Confirmed_Attendee.",
                time: "11:42 AM"
            },
            // Branch 2: Hesitation → Voice AI trigger
            {
                trigger: "I'll think about it",
                type: "system",
                content: "🎙️ Hesitation detected. Triggering Voice AI breakthrough protocol via ElevenLabs...",
                time: "11:46 AM"
            },
            {
                trigger: "I'll think about it",
                type: "kira",
                content: "",
                time: "11:46 AM",
                hasVoice: true,
                voiceContent: {
                    title: "Personal Message from Chris",
                    duration: "45 seconds",
                    audioSrc: "/Chris.mp3",
                    transcript: "Alex... thinking often looks like stalling. And stalling in business doesn't mean you're being cautious — it means the market is moving while you're standing still. December isn't a month to 'think about it' — it's your launchpad. This clinic isn't about learning more theory. It's about calibrating your trajectory for 2026 before everyone else wakes up in January scrambling. You in?"
                },
                options: [
                    { text: "Okay, send the link", type: "positive" },
                    { text: "Can't listen now", type: "negative" },
                    { text: "Still not sure", type: "neutral" }
                ]
            },
            {
                trigger: "Okay, send the link",
                type: "kira",
                content: "Perfect. Here's your direct access: [Link]. Let's get you clear!",
                time: "11:50 AM"
            },
            {
                trigger: "Okay, send the link",
                type: "system",
                content: "✓ Voice breakthrough successful! User tagged: Voice_Converted. Registration confirmed.",
                time: "11:50 AM"
            },
            {
                trigger: "Can't listen now",
                type: "kira",
                content: "No prob. TL;DR: Don't let 'thinking' become stalling. December is your launchpad. Join us to calibrate. Here's the link: [Link]",
                time: "11:50 AM"
            },
            {
                trigger: "Can't listen now",
                type: "system",
                content: "✓ Link sent despite voice rejection. User tagged: Text_Converted.",
                time: "11:50 AM"
            },
            {
                trigger: "Still not sure",
                type: "kira",
                content: "Got it. I won't push. If things clear up, the door is open. Good luck with the sprint.",
                time: "11:50 AM"
            },
            {
                trigger: "Still not sure",
                type: "system",
                content: "✓ User declined. Tagged: Followup_Jan_2026.",
                time: "11:50 AM"
            },
            // Branch 3: Uncertainty → Checklist
            {
                trigger: "Not sure / Maybe later",
                type: "kira",
                content: "Totally get it. Thinking is natural — but December is your launchpad. Want me to send a quick 3-point checklist to help decide?",
                time: "11:46 AM",
                options: [
                    { text: "Yes, send checklist", type: "positive" },
                    { text: "No thanks", type: "negative" }
                ]
            },
            {
                trigger: "Yes, send checklist",
                type: "system",
                content: "✓ Decision checklist sent. User tagged: Checklist_Engaged.",
                time: "11:48 AM"
            },
            {
                trigger: "No thanks",
                type: "kira",
                content: "Understood. The offer stays open if you change your mind. Take care!",
                time: "11:48 AM"
            },
            {
                trigger: "No thanks",
                type: "system",
                content: "✓ User declined. Tagged: Low_Interest.",
                time: "11:48 AM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Alex! The Final Sprint Momentum Clinic is happening this week. We've saved a spot for you — are you in a position to join us?", time: "11:40 AM" },
            { type: "user", content: "I'll think about it.", time: "11:45 AM" },
            { type: "system", content: "🎙️ Hesitation detected. Triggering Voice AI breakthrough protocol via ElevenLabs...", time: "11:46 AM" },
            { type: "kira", content: "", time: "11:46 AM", hasVoice: true, voiceContent: { title: "Personal Message from Chris", duration: "45 seconds", audioSrc: "/Chris.mp3", transcript: "Alex... thinking often looks like stalling. And stalling in business doesn't mean you're being cautious — it means the market is moving while you're standing still. December isn't a month to 'think about it' — it's your launchpad. This clinic isn't about learning more theory. It's about calibrating your trajectory for 2026 before everyone else wakes up in January scrambling. You in?" } },
            { type: "user", content: "Okay, send the link.", time: "11:50 AM" },
            { type: "kira", content: "Perfect. Here's your direct access: [Link]. Let's get you clear!", time: "11:50 AM" },
            { type: "system", content: "✓ Voice breakthrough successful! User tagged: Voice_Converted. Registration confirmed.", time: "11:50 AM" }
        ],
        tags: [
            { name: "Voice_Engaged", type: "engage", icon: "🎤", tooltip: { title: "Voice Message Engaged", description: "User responded positively after AI voice message. Emotional breakthrough achieved - 63.2% conversion rate." } },
            { name: "Breakthrough_Achieved", type: "status", icon: "💎", tooltip: { title: "Emotional Breakthrough", description: "Voice AI successfully converted hesitant lead. 60%+ conversion rate to paid programs." } }
        ],
        logs: [
            { time: "11:45 AM", title: "Intent Analysis", detail: "Hesitation pattern detected - ANALYTICAL_STALLING" },
            { time: "11:46 AM", title: "Voice AI Triggered", detail: "ElevenLabs API called to generate personalized voice message" },
            { time: "11:50 AM", title: "Conversion Success", detail: "Voice breakthrough achieved - User converted" }
        ],
        currentStatus: { intent: "POSITIVE - Voice Converted", nextAction: "Day 14 Event Attendance", queue: "High-Value Sales Pipeline" }
    },

    // ========== Use Case I-5: Emma - Day 12 Downsell ==========
    {
        id: 5,
        name: "Emma",
        title: "Day 12 - The Downsell Pivot",
        avatar: { bg: "#f59e0b", initials: "ED" },
        statusBadge: "active",
        day: 12,
        preview: "Timing conflict solution...",
        steps: [
            {
                type: "kira",
                content: "Hey Emma! Final call — the Momentum Clinic is this week. Are you ready to lock in your spot?",
                time: "10:15 AM",
                options: [
                    { text: "Yes, I'm ready", type: "positive" },
                    { text: "I have a board meeting at that time", type: "neutral" },
                    { text: "Not interested", type: "negative" }
                ]
            },
            // Branch 1: Direct confirmation
            {
                trigger: "Yes, I'm ready",
                type: "kira",
                content: "Excellent! Your spot is confirmed. Link: [Link]. Can't wait to see you there!",
                time: "10:17 AM"
            },
            {
                trigger: "Yes, I'm ready",
                type: "system",
                content: "✓ Registration confirmed. User tagged: Webinar_Reg, Direct_Convert.",
                time: "10:17 AM"
            },
            // Branch 2: Timing conflict → Downsell pivot
            {
                trigger: "I have a board meeting at that time",
                type: "kira",
                content: "Ah, timing conflict. Since you can't make the live clinic, let's pivot. I've opened up a few slots for a 15-min Clarity Call with my team. No fluff, just strategy. Want the link?",
                time: "10:19 AM",
                options: [
                    { text: "Yes, send the link", type: "positive" },
                    { text: "Is this a sales call?", type: "negative" },
                    { text: "Just send me the PDF", type: "neutral" }
                ]
            },
            {
                trigger: "Yes, send the link",
                type: "kira",
                content: "Done. Your 15-min Clarity Call slot is reserved. Link: [Link]. See you soon!",
                time: "10:22 AM"
            },
            {
                trigger: "Yes, send the link",
                type: "system",
                content: "✓ Downsell accepted. Booking link sent. Sales team notified - Hot Lead Alert triggered.",
                time: "10:22 AM"
            },
            {
                trigger: "Is this a sales call?",
                type: "kira",
                content: "It's a Strategy Diagnostic. We look at your Q1 goals and see if there are gaps. If we can help, we'll say so. If not, you get a plan anyway. Fair?",
                time: "10:22 AM",
                options: [
                    { text: "Fair, send the link", type: "positive" },
                    { text: "Still not sure", type: "negative" }
                ]
            },
            {
                trigger: "Fair, send the link",
                type: "kira",
                content: "Perfect. Here's your booking link: [Link]. Looking forward to helping you plan Q1!",
                time: "10:24 AM"
            },
            {
                trigger: "Fair, send the link",
                type: "system",
                content: "✓ Objection handled. Call booked. User tagged: HotLead_Clinic_Downsell.",
                time: "10:24 AM"
            },
            {
                trigger: "Still not sure",
                type: "kira",
                content: "No pressure. If it's not the right time, that's okay. Wishing you success with your board meeting!",
                time: "10:24 AM"
            },
            {
                trigger: "Still not sure",
                type: "system",
                content: "✓ User declined. Tagged: Followup_Q1_2026.",
                time: "10:24 AM"
            },
            {
                trigger: "Just send me the PDF",
                type: "kira",
                content: "I can send the PDF, but context is everything. How about I send it, and you promise to read page 3? Deal?",
                time: "10:22 AM",
                options: [
                    { text: "Deal", type: "positive" },
                    { text: "Just the PDF please", type: "neutral" }
                ]
            },
            {
                trigger: "Deal",
                type: "kira",
                content: "Great! PDF sent: [Link]. Page 3 is where the gold is. Let me know if you want to discuss after reading!",
                time: "10:24 AM"
            },
            {
                trigger: "Deal",
                type: "system",
                content: "✓ PDF sent. User tagged: Lead_Nurture, PDF_Engaged.",
                time: "10:24 AM"
            },
            {
                trigger: "Just the PDF please",
                type: "system",
                content: "✓ PDF sent. User tagged: Content_Only_Interest.",
                time: "10:24 AM"
            },
            // Branch 3: Direct rejection
            {
                trigger: "Not interested",
                type: "kira",
                content: "Got it. Thanks for letting me know. If things change, feel free to reach out. All the best!",
                time: "10:17 AM"
            },
            {
                trigger: "Not interested",
                type: "system",
                content: "✓ User declined. Tagged: Low_Interest, Followup_Q2_2026.",
                time: "10:17 AM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Emma! Final call — the Momentum Clinic is this week. Are you ready to lock in your spot?", time: "10:15 AM" },
            { type: "user", content: "I really want to, but I have a board meeting at that time.", time: "10:18 AM" },
            { type: "kira", content: "Ah, timing conflict. Since you can't make the live clinic, let's pivot. I've opened up a few slots for a 15-min Clarity Call with my team. No fluff, just strategy. Want the link?", time: "10:19 AM" },
            { type: "user", content: "Yes, send the link.", time: "10:22 AM" },
            { type: "kira", content: "Done. Your 15-min Clarity Call slot is reserved. Link: [Link]. See you soon!", time: "10:22 AM" },
            { type: "system", content: "✓ Downsell accepted. Booking link sent. Sales team notified - Hot Lead Alert.", time: "10:22 AM" }
        ],
        tags: [
            { name: "HotLead_Clinic_Downsell", type: "status", icon: "🔥", tooltip: { title: "Hot Lead - Downsell Pivot", description: "Strong intent but timing conflict. Pivoted to 15-min call. 65%+ close rate." } },
            { name: "Accepted_1on1", type: "engage", icon: "📞", tooltip: { title: "1-on-1 Consultation Accepted", description: "High commitment signal. Willing to invest personal time." } }
        ],
        logs: [
            { time: "10:18 AM", title: "Intent Analysis", detail: "Positive interest with timing barrier - DOWNSELL_PIVOT strategy" },
            { time: "10:22 AM", title: "Sales Alert", detail: "Slack notification sent to #sales-hot-leads. Context: Timing conflict, high intent." }
        ],
        currentStatus: { intent: "POSITIVE - High Intent", nextAction: "1-on-1 Consultation Booked", queue: "High-Priority Sales Pipeline" }
    },

    // ========== Use Case I-6: Michael - Day 14 Live Event ==========
    {
        id: 6,
        name: "Michael",
        title: "Day 14 - Live Event Coordination",
        avatar: { bg: "#06b6d4", initials: "MC" },
        statusBadge: "active",
        day: 14,
        preview: "Day-of confirmation...",
        steps: [
            {
                type: "kira",
                content: "Hey Michael, Momentum Clinic starts in 2 hours. Still joining?",
                time: "4:05 PM",
                options: [
                    { text: "Yes, I'm joining", type: "positive" },
                    { text: "Running late but will join", type: "neutral" },
                    { text: "Not sure yet", type: "neutral" }
                ]
            },
            // Branch 1: Confirmed
            {
                trigger: "Yes, I'm joining",
                type: "kira",
                content: "Great. Here is your unique Zoom link: [Link]. See you inside!",
                time: "4:08 PM"
            },
            {
                trigger: "Yes, I'm joining",
                type: "system",
                content: "✓ Attendee confirmed. Unique Zoom link generated. Event tracking activated.",
                time: "4:08 PM"
            },
            // Branch 2: Running late
            {
                trigger: "Running late but will join",
                type: "kira",
                content: "No stress. The session is recorded for 24h. Join when you can — we'll save your spot.",
                time: "4:08 PM"
            },
            {
                trigger: "Running late but will join",
                type: "system",
                content: "✓ User tagged: Late_Attendee. Session link sent. Recording access granted.",
                time: "4:08 PM"
            },
            // Branch 3: Uncertain
            {
                trigger: "Not sure yet",
                type: "kira",
                content: "Totally fine. The energy is high — you'll feel it even if you join 10 mins late. Want me to send a quick agenda?",
                time: "4:08 PM",
                options: [
                    { text: "Yes, send agenda", type: "positive" },
                    { text: "I'll decide soon", type: "neutral" }
                ]
            },
            {
                trigger: "Yes, send agenda",
                type: "kira",
                content: "Here's what we're covering: [Agenda Link]. Your Zoom link is also ready: [Link]",
                time: "4:10 PM"
            },
            {
                trigger: "Yes, send agenda",
                type: "system",
                content: "✓ Agenda sent. User tagged: Uncertain_Attendee.",
                time: "4:10 PM"
            },
            {
                trigger: "I'll decide soon",
                type: "kira",
                content: "Understood. The link is here when you're ready: [Link]. Hope to see you!",
                time: "4:10 PM"
            },
            {
                trigger: "I'll decide soon",
                type: "system",
                content: "✓ Link sent. User tagged: Maybe_Attendee.",
                time: "4:10 PM"
            }
        ],
        messages: [
            { type: "kira", content: "Hey Michael, Momentum Clinic starts in 2 hours. Still joining?", time: "4:05 PM" },
            { type: "user", content: "Yes, I'm joining.", time: "4:08 PM" },
            { type: "kira", content: "Great. Here is your unique Zoom link: [Link]. See you inside!", time: "4:08 PM" },
            { type: "system", content: "✓ Attendee confirmed. Unique Zoom link generated. Event tracking activated.", time: "4:08 PM" }
        ],
        tags: [
            { name: "Confirmed_Attendee", type: "engage", icon: "✅", tooltip: { title: "Confirmed Day-of Attendee", description: "User confirmed within 2 hours of event. 90%+ show-up probability." } },
            { name: "HighEnergy", type: "intent", icon: "⚡", tooltip: { title: "High Energy State", description: "User is excited. Perfect mental state for receiving offers." } }
        ],
        logs: [
            { time: "4:08 PM", title: "Intent Analysis", detail: "Strong confirmation - User ready to attend" },
            { time: "4:08 PM", title: "Zoom API Call", detail: "Generated unique meeting link. Registrant confirmed in dashboard." }
        ],
        currentStatus: { intent: "POSITIVE - High Energy", nextAction: "Event Attendance → Post-Event Offer", queue: "Live Event - Active Attendees" }
    },

    // ========== Use Case I-7: Jessica - Post-Event Recovery ==========
    {
        id: 7,
        name: "Jessica",
        title: "Post-Event Nurture (No-Show Recovery)",
        avatar: { bg: "#ec4899", initials: "JL" },
        statusBadge: "active",
        day: "Post",
        preview: "Surround sound recovery...",
        steps: [
            {
                type: "system",
                content: "⚠️ Event ended 30 minutes ago. Jessica registered but did not attend. Initiating No-Show Recovery protocol.",
                time: "7:05 PM"
            },
            {
                type: "kira",
                content: "🎙️ Voice Message: Missed you today... the energy was exactly what we needed. Listen here:",
                time: "7:10 PM",
                hasVoice: true,
                voiceContent: {
                    title: "Personal Follow-up from Chris",
                    duration: "38 seconds",
                    transcript: "Jessica, missed you today. The momentum in that room was exactly what I was hoping for — clarity, energy, and people making real decisions about 2026. I know life gets hectic. So I'm sending you the key insights from today as a PDF. But here's the thing: insights without implementation is just entertainment. If you're serious about your Q1 sprint, let's book a quick 15-minute call. No pitch. Just calibration. Link below."
                },
                options: [
                    { text: "Download PDF Summary", type: "positive" },
                    { text: "Book 15-min Clarity Call", type: "positive" },
                    { text: "I'll check later", type: "negative" }
                ]
            },
            // Branch 1: PDF Download
            {
                trigger: "Download PDF Summary",
                type: "kira",
                content: "Here's the PDF: [Link]. It covers the '3 Hidden Traps' of December. Want to book a 15-min Clarity Call to discuss?",
                time: "7:45 PM",
                options: [
                    { text: "Yes, book the call", type: "positive" },
                    { text: "Just the PDF for now", type: "neutral" }
                ]
            },
            {
                trigger: "Yes, book the call",
                type: "kira",
                content: "Excellent! Pick a time that works for you: [Booking Link]. Looking forward to helping you win Q1!",
                time: "7:47 PM"
            },
            {
                trigger: "Yes, book the call",
                type: "system",
                content: "✓ Recovery successful! User entered high-ticket sales pipeline. Team alerted.",
                time: "7:47 PM"
            },
            {
                trigger: "Just the PDF for now",
                type: "kira",
                content: "Got it. The booking link will be in the PDF footer if you change your mind. Happy reading!",
                time: "7:47 PM"
            },
            {
                trigger: "Just the PDF for now",
                type: "system",
                content: "✓ PDF engaged. User tagged: Nurture_Content_Consumer.",
                time: "7:47 PM"
            },
            // Branch 2: Direct booking
            {
                trigger: "Book 15-min Clarity Call",
                type: "kira",
                content: "Perfect. Pick a time that works for you: [Booking Link]. Looking forward to helping you win Q1!",
                time: "7:45 PM"
            },
            {
                trigger: "Book 15-min Clarity Call",
                type: "system",
                content: "✓ Recovery successful! User entered high-ticket sales pipeline. Team alerted.",
                time: "7:46 PM"
            },
            // Branch 3: Delay
            {
                trigger: "I'll check later",
                type: "kira",
                content: "No rush. The PDF and booking link will stay here for 7 days. Just reply 'sprint' if you want a reminder.",
                time: "7:45 PM"
            },
            {
                trigger: "I'll check later",
                type: "system",
                content: "✓ User tagged: No_Show_Delayed. 7-day reminder set.",
                time: "7:45 PM"
            }
        ],
        messages: [
            { type: "system", content: "⚠️ Event ended 30 minutes ago. Jessica registered but did not attend. Initiating No-Show Recovery protocol.", time: "7:05 PM" },
            { type: "kira", content: "🎙️ Voice Message: Missed you today... the energy was exactly what we needed. Listen here:", time: "7:10 PM", hasVoice: true, voiceContent: { title: "Personal Follow-up from Chris", duration: "38 seconds", transcript: "Jessica, missed you today. The momentum in that room was exactly what I was hoping for — clarity, energy, and people making real decisions about 2026. I know life gets hectic. So I'm sending you the key insights from today as a PDF. But here's the thing: insights without implementation is just entertainment. If you're serious about your Q1 sprint, let's book a quick 15-minute call. No pitch. Just calibration. Link below." } },
            { type: "system", content: "📧 Simultaneous email sent: Subject: 'Missed you (and the momentum)' with PDF + booking link.", time: "7:10 PM" },
            { type: "user", content: "Sorry I couldn't make it. I'll book the call.", time: "7:45 PM" },
            { type: "kira", content: "Perfect. Pick a time that works for you: [Booking Link]. Looking forward to helping you win Q1!", time: "7:45 PM" },
            { type: "system", content: "✓ Recovery successful! User entered high-ticket sales pipeline. Team alerted.", time: "7:46 PM" }
        ],
        tags: [
            { name: "No_Show_Recovery", type: "status", icon: "🎯", tooltip: { title: "No-Show Successfully Recovered", description: "Extremely high-value conversion. 85.6% recovery rate via surround-sound strategy." } },
            { name: "Surround_Sound_Engaged", type: "engage", icon: "📡", tooltip: { title: "Multi-Channel Recovery", description: "Responded to voice + email + SMS recovery. High receptiveness." } },
            { name: "Converted_Call", type: "status", icon: "💎", tooltip: { title: "Consultation Booked", description: "Ultimate intent signal. 70%+ close rate." } }
        ],
        logs: [
            { time: "7:05 PM", title: "Event Status Check", detail: "Zoom API confirms no-show. Trigger: Absent 30 min post-event." },
            { time: "7:10 PM", title: "Recovery Protocol", detail: "Multi-channel: Voice (ElevenLabs) + Email (ActiveCampaign) + SMS (Twilio)." },
            { time: "7:46 PM", title: "Sales Alert", detail: "URGENT: User booked call. High-value pipeline entry." }
        ],
        currentStatus: { intent: "RECOVERED → POSITIVE", nextAction: "1-on-1 Consultation", queue: "Ultra-High-Value Sales Pipeline" }
    }
];
