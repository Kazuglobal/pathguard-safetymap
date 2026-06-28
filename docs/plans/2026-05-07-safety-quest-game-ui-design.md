# PathGuard SafetyMap Game UI Integration Plan

## Summary

Add a new game feature at `/safety-quest` that brings together the modes shown in the attached UI concepts 01, 02, and 03.

The feature turns the current photo hazard game into a broader child-friendly safety game experience: adventure map, hazard finding, route quiz battles, daily missions, rewards, collections, rankings, avatar, and room screens. The v1 priority is to make the core loop playable: select a stage, find hazards in a real school-route photo, answer a quiz, receive points and rewards, and track progress.

Complex real-time or device-specific features, such as true AR overlays and live team play, should be represented in the UI in v1 but treated as v2 implementation candidates.

## Included Modes

### UI Concept 01

- **ぼうけんマップ**
  - Main game home.
  - Shows a school-neighborhood adventure route with numbered stages, stars, locks, today's mission, points, and player level.
  - Each stage opens a photo hazard challenge or route quiz.

- **危険さがしチャレンジ**
  - Core gameplay mode.
  - User taps or drags around dangerous spots in a posted school-route photo or their own uploaded route photo.
  - The game shows timer, combo, score, mascot feedback, and `GOOD +50pt` style feedback.

- **まもるんとパトロール**
  - Lightweight side-scrolling patrol mode.
  - User moves left/right through a safe-route scene and collects safe power while avoiding or identifying danger signs.
  - v1 can implement this as a simple 2D React mini-game without physics complexity.

- **きょうりょくミッション**
  - Team progress screen.
  - v1 shows class/team-style aggregate progress and shared goals.
  - Real-time multiplayer collaboration is deferred to v2.

- **クリア報酬**
  - Stage clear result screen.
  - Shows earned points, coins, badges, items, route unlocks, and next-stage CTA.

### UI Concept 02

- **デイリーたんけん**
  - Daily hub with check-in streak, today's missions, level, points, gems, and notification icon.
  - Missions include finding three hazards, checking safe walking, answering quizzes, and playing consecutive days.

- **ルートクイズバトル**
  - Quiz battle mode.
  - Uses AI analysis from route photos to generate questions such as "What happens if a car suddenly comes out of the shadow?"
  - Includes player HP, opponent HP, three answer buttons, hint/shield/heart items, and result feedback.

- **なぞときミッション**
  - Mystery mission mode.
  - User collects hint cards, then answers what danger is hidden in the scene.
  - Good fit for hidden hazards such as blind corners, shadows, blocked signs, or poor visibility.

- **ガチャ・コレクション**
  - Reward collection mode.
  - No paid gacha or probability sales in v1.
  - Uses free tickets earned through play to unlock heroes, seals, badges, and safety items.

- **ランキング＆イベント**
  - Weekly and event leaderboard.
  - Shows national ranking, friend ranking, user rank, event progress, and event participation CTA.

### UI Concept 03

- **アバターカスタム**
  - Player avatar customization.
  - v1 supports light customization: hat, color, title, and basic outfit selection.
  - Detailed character equipment is deferred to v2.

- **まちをまもろう**
  - Board-game style city defense map.
  - User advances through stages, clears dangerous spots, collects stars, and unlocks route zones.
  - This can share data with `ぼうけんマップ` while presenting a more game-like city board.

- **ARたんけんフォト**
  - Camera-style photo mission screen.
  - v1 supports camera/photo upload UI and overlays mission markers after upload.
  - True live AR object placement is deferred to v2.

- **安全ヒーロー図鑑**
  - Collection encyclopedia.
  - Shows heroes, badges, route creatures, stories, completion rate, and locked items.

- **マイルーム**
  - Player room/home screen.
  - Shows avatar, current level, monthly missions, trophy/badge display, memories, map, and CTA to go exploring.

## Product Scope

### v1 Core Loop

1. User opens `/safety-quest`.
2. User lands on `ぼうけんマップ`.
3. User selects an unlocked stage.
4. Stage opens `危険さがしチャレンジ`.
5. User marks dangerous spots in a photo.
6. Backend compares markers with AI-detected hazards.
7. User gets score, explanation, rewards, and mission progress.
8. User can continue to quiz battle, rewards, collection, or next stage.

### Photo Sources

- **みんなの通学路写真**
  - Uses approved public `danger_reports` photos.
  - Only approved or resolved reports are eligible.
  - Exact coordinates are not shown in game UI; show broad area labels such as city or town.

- **自分で練習**
  - Uses direct upload from the player.
  - Private by default.
  - Not exposed to other users unless routed through an explicit report submission and approval flow.

### Out Of Scope For v1

- Paid gacha or real-money mechanics.
- Live multiplayer team play.
- True AR camera tracking.
- Full avatar equipment system.
- Fully decorated room editor.
- Publishing a private uploaded school-route photo directly from the game without review.

## UI Design Direction

### Visual Style

- Child-friendly safety adventure game.
- Bright, energetic, and readable.
- Primary colors: blue, teal, white, orange.
- Semantic colors:
  - Red: danger.
  - Yellow: caution.
  - Green: safe/correct.
  - Blue: navigation, shield, safety.

### Layout

- Use a landscape phone-game composition as the design reference.
- On desktop, center the game panel with a maximum game width and a soft background.
- On mobile portrait, stack controls vertically and keep the photo canvas first.
- Avoid marketing-style hero pages. The first screen should be the playable game hub.

### Components

- Top status bar:
  - Avatar, level, points, gems/tickets, notification icon.
- Map/stage cards:
  - Numbered route nodes, stars, locks, mission progress.
- Challenge photo area:
  - Large real-photo canvas.
  - Marker rings, hit feedback, combo counter, timer, mascot speech bubble.
- Result screen:
  - Points, coins, item cards, next-stage button, map button.
- Collection screen:
  - Tabs for heroes, badges, route creatures, stories.
- Daily screen:
  - Check-in streak, mission cards, bonus banner.

### Accessibility And Responsiveness

- Keep button text short and large enough for children.
- Avoid overlapping text on badges, status chips, and result cards.
- Do not scale font size with viewport width.
- Use fixed aspect ratios for game panels, photo canvases, status chips, and reward cards.
- Provide clear focus states and keyboard-operable controls for non-touch users.

## Implementation Changes

### Frontend

- Add `/safety-quest` route.
- Add a new game shell component with screen state:
  - `map`
  - `challenge`
  - `quiz-battle`
  - `mystery`
  - `daily`
  - `rewards`
  - `collection`
  - `ranking`
  - `avatar`
  - `room`
- Reuse and adapt existing hazard-game components:
  - Image upload.
  - Interactive marking canvas.
  - AI analysis result display.
  - Score breakdown.
- Add game-specific UI components:
  - Stage map.
  - Status bar.
  - Mission cards.
  - Reward reveal.
  - Hero collection grid.
  - Quiz battle panel.
  - Mystery hint cards.

### Backend

- Add `GET /api/safety-quest/challenges`.
  - Returns eligible public challenges and player progress.
- Add `POST /api/safety-quest/attempts`.
  - Submits markers or quiz answers.
  - Scores attempt.
  - Awards points.
  - Updates missions.
- Add `POST /api/safety-quest/private-practice`.
  - Accepts private uploaded image data.
  - Runs the existing hazard analysis pipeline.
  - Returns score and educational feedback without publishing the image.
- Add `GET /api/safety-quest/profile`.
  - Returns points, level, streak, rewards, and collection progress.

### Database

- Add `safety_quest_challenges`.
  - `id`
  - `source_type`: `report`, `sample`, or `private`
  - `report_id`
  - `title`
  - `image_url`
  - `thumbnail_url`
  - `area_label`
  - `difficulty`
  - `status`
  - `ai_result`
  - `created_at`
  - `updated_at`

- Add `safety_quest_attempts`.
  - `id`
  - `user_id`
  - `challenge_id`
  - `mode`
  - `user_markers`
  - `answer_payload`
  - `score`
  - `accuracy`
  - `duration_ms`
  - `points_awarded`
  - `created_at`

- Add `safety_quest_rewards`.
  - `id`
  - `reward_key`
  - `reward_type`
  - `name`
  - `rarity`
  - `asset_url`
  - `unlock_condition`
  - `created_at`

- Add `safety_quest_user_rewards`.
  - `user_id`
  - `reward_id`
  - `quantity`
  - `acquired_at`

- Add mission target types:
  - `safety_quest_play`
  - `safety_quest_find_hazard`
  - `safety_quest_quiz_correct`
  - `safety_quest_streak`
  - `safety_quest_event`

## Safety And Privacy

- Public challenges must come from already approved report photos.
- Private practice uploads stay private and should not appear in public challenge lists.
- The game should not display exact route coordinates for children-facing play.
- Add upload copy that asks users not to upload faces, names, school IDs, home entrances, or license plates.
- Add a moderation-ready status field so admins can retire a challenge if a photo is unsuitable.
- Cap private-practice point rewards to reduce abuse from repeated uploads.

## Test Plan

### Unit Tests

- Marker overlap and accuracy scoring.
- Point calculation and daily caps.
- Reward unlock conditions.
- Challenge filtering by status and source type.
- API auth failures and invalid payloads.

### Component Tests

- Stage selection from adventure map.
- Hazard marking on the photo canvas.
- Quiz answer feedback.
- Daily mission progress.
- Reward reveal screen.
- Collection locked/unlocked states.
- Empty state when no public challenges exist.

### Browser Verification

- Open `/safety-quest` in the in-app browser.
- Verify desktop layout.
- Verify mobile portrait layout.
- Verify landscape game-panel layout.
- Complete one public photo challenge.
- Complete one private upload practice flow.
- Confirm no text overlaps in status bar, mission cards, quiz buttons, and result cards.

## Acceptance Criteria

- A logged-in user can enter `/safety-quest`, select a stage, mark hazards in a photo, and receive score plus rewards.
- Approved posted route photos can become playable public challenges.
- A user can upload their own route photo for private practice.
- Daily missions, rewards, and collection progress update after play.
- The UI visibly reflects the attached game concepts: adventure map, challenge photo, quiz battle, daily hub, rewards, collection, ranking, avatar, and room.
- The first implementation avoids paid mechanics and protects private school-route photos.

