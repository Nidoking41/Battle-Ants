# Sprite Animation System - Setup Complete! 🎨

The sprite animation system is now fully integrated and ready for your Aseprite sprites!

## What's Been Set Up

### 1. **Sprite Configuration** (`src/spriteConfig.js`)
- Defines sprite paths and frame counts for all ant types
- Configures animation speeds (idle: 150ms, walk: 100ms, attack: 75ms)
- Default sprite size: 32x32 pixels

### 2. **Animation Hook** (`src/useSprites.js`)
- Manages sprite animation states for all ants
- Automatically cycles through frames at the right speed
- Tracks which animation each ant is currently playing

### 3. **Integration** (updated `src/App.js`)
- Sprites render automatically when available
- Falls back to emoji icons if sprites don't exist yet
- Animations trigger on:
  - **Idle**: Default state when ant is not moving/attacking
  - **Walk**: Triggered during movement
  - **Attack**: Triggered when attacking

### 4. **Sprite Folder Structure**
```
public/sprites/ants/
├── README.md                  (Instructions for creating sprites)
├── queen_idle.png            (128x32 - 4 frames horizontal)
├── queen_walk.png            (128x32 - 4 frames horizontal)
├── queen_attack.png          (128x32 - 4 frames horizontal)
├── scout_idle.png
├── scout_walk.png
├── scout_attack.png
└── ... (same pattern for all ant types)
```

## How to Create Sprites in Aseprite

### Quick Start Guide

1. **Create New Sprite in Aseprite**
   - File → New
   - Width: 128 pixels (32 × 4 frames)
   - Height: 32 pixels
   - Mode: RGBA

2. **Set Up Grid**
   - View → Grid → Grid Settings
   - Grid width: 32
   - Grid height: 32
   - This divides your canvas into 4 equal frames

3. **Create 4 Frames**
   - In the Timeline panel (bottom), you should see Frame 1
   - Click the "New Frame" button 3 times to create Frames 2, 3, and 4
   - Each frame represents one frame of animation

4. **Draw Your Ant**
   - Draw in each grid cell (each represents one frame)
   - Frame 1: Starting pose
   - Frame 2: Mid-motion
   - Frame 3: Full motion
   - Frame 4: Return/transition

5. **Export Sprite Sheet**
   - File → Export Sprite Sheet
   - Layout: **Horizontal** (frames side-by-side)
   - Trim: None (keep all 128x32 pixels)
   - Output file: Save to `public/sprites/ants/`
   - Name it: `{anttype}_{animation}.png` (e.g., `scout_idle.png`)

### Animation Tips

**Idle Animation** (subtle, loops forever):
- Frame 1: Normal stance
- Frame 2: Slight up/antenna move
- Frame 3: Highest point
- Frame 4: Return to normal

**Walk Animation** (energetic, matches 300ms movement):
- Frame 1: Legs extended forward
- Frame 2: Mid-stride
- Frame 3: Legs extended backward
- Frame 4: Other mid-stride

**Attack Animation** (snappy, quick):
- Frame 1: Wind-up/prepare
- Frame 2: Strike/shoot
- Frame 3: Follow-through
- Frame 4: Recovery

## Ant Types to Create (9 total)

1. **queen** - Large, regal ant with crown
2. **scout** - Small, fast-looking ant
3. **soldier** - Medium, combat-ready ant (Marauder)
4. **tank** - Large, armored ant (Bullet Ant)
5. **spitter** - Ant with visible acid sac (Acid Ant)
6. **bomber** - Ant with bomb-like abdomen
7. **bombardier** - Artillery ant with large launcher
8. **drone** - Worker ant with tool/pickaxe
9. **healer** - Mystical ant with sparkles (Weaver Ant)

## Testing Your Sprites

1. Export your sprite to `public/sprites/ants/`
2. Game will automatically detect and use it
3. If sprite fails to load, game falls back to emoji
4. Check browser console for any loading errors

## Current Status

✅ Sprite system fully integrated
✅ Animation states working (idle/walk/attack)
✅ Automatic fallback to emojis
✅ Ready for your Aseprite sprites!

## Example Workflow

1. Start with one ant (e.g., scout) with all 3 animations
2. Test in-game to see how it looks
3. Adjust timing in `spriteConfig.js` if needed
4. Create remaining ants using the same process

## Troubleshooting

**Sprite not showing?**
- Check file path: `public/sprites/ants/{anttype}_{animation}.png`
- Check dimensions: Must be exactly 128x32 pixels
- Check file name: Must match exactly (lowercase, underscores)

**Animation too fast/slow?**
- Edit `ANIMATION_SPEEDS` in `src/spriteConfig.js`
- idle: 150ms per frame (default)
- walk: 100ms per frame
- attack: 75ms per frame

**Want different frame counts?**
- Edit `frames` property in `spriteConfig.js`
- Update sprite sheet width accordingly (32 × frame_count)

## Notes

- Sprites are 32x32 but render slightly smaller to fit in hex tiles
- Player color circles still appear behind sprites
- Burrowed ants show 🕳️ emoji (no sprite)
- Gray overlay still applied to ants with no remaining actions

Good luck with your sprite creation! 🐜✨
