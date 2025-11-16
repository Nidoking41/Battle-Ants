# Ant Sprite Guidelines

## Sprite Specifications

- **Size**: 32x32 pixels per frame
- **Format**: PNG with transparency
- **Layout**: Horizontal sprite strip (frames side-by-side)

## File Naming Convention

Each ant type needs 3 sprite files:
- `{anttype}_idle.png` - Idle/standing animation
- `{anttype}_walk.png` - Walking/movement animation
- `{anttype}_attack.png` - Attack animation

## Ant Types to Create

1. `queen` - Queen Ant
2. `scout` - Scout Ant
3. `soldier` - Marauder Ant
4. `tank` - Bullet Ant
5. `spitter` - Acid Ant
6. `bomber` - Exploding Ant
7. `bombardier` - Bombardier
8. `drone` - Worker Drone
9. `healer` - Weaver Ant

## Frame Counts

Each animation should have **4 frames** arranged horizontally:

```
[Frame 0][Frame 1][Frame 2][Frame 3]
```

So each sprite sheet will be **128x32 pixels** (4 frames × 32 pixels)

## Animation Guidelines

### Idle Animation (4 frames)
- Subtle breathing/standing animation
- Should loop smoothly
- Example: slight bob up/down, antenna wiggle

### Walk Animation (4 frames)
- Legs moving
- Body slight bounce
- Should loop smoothly for continuous movement

### Attack Animation (4 frames)
- Wind-up → Strike → Follow-through → Return
- Should feel snappy and impactful
- For ranged units: prepare → shoot → recoil → recover

## Color Considerations

- Ants will be tinted with player colors (blue/red circles around them)
- Keep base ant colors neutral or brown
- Add distinct features for each ant type so they're recognizable

## Aseprite Tips

1. Create new sprite: 128x32 pixels (for 4 frames)
2. Set grid: 32x32 pixels
3. Create 4 frames
4. Draw each frame in its 32x32 grid cell
5. Export as PNG: File → Export Sprite Sheet
   - Layout: Horizontal
   - Trim: None
   - Output file: Save to this folder

## Example File Structure

```
public/sprites/ants/
├── queen_idle.png      (128x32 - 4 frames)
├── queen_walk.png      (128x32 - 4 frames)
├── queen_attack.png    (128x32 - 4 frames)
├── scout_idle.png
├── scout_walk.png
├── scout_attack.png
└── ... (all other ant types)
```

## Testing

Once you add sprites to this folder, the game will automatically use them instead of emoji icons. The system will fall back to emojis if sprites are not found.
