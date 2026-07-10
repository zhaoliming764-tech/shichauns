# 图片驱动 UI 换肤流程

项目采用“代码交互层 + 生成图片皮肤层”：HTML/JavaScript 保留文字、状态、点击热区和动画，生成图片负责桌面、角色框、卡框、手牌托盘、日志框、阶段条、弹窗与按钮外观。

## 快速整套替换

1. 生成一张 16:9、无文字的商业卡牌桌游 UI 母版，保持当前母版的区域结构。
2. 将图片保存为 `assets/generated/ui-art-table-v4.png`。
3. 运行：

   ```powershell
   python tools/build_assets.py
   ```

4. 刷新页面。脚本会自动生成 `assets/processed/ui/skin-*` 组件并完成整套替换。

## 自动生成、审查与重试

密钥保存在被 Git 忽略的 `.env.local` 后，可以直接运行：

```powershell
node tools/generate_ui_skin.mjs --attempts 3 --quality medium
```

管线使用 `ui-layout.json` 作为唯一几何真源：生成提示词会写入精确像素区域，`build_assets.py` 使用同一组归一化坐标裁图，`review_ui_skin.py` 检查每个槽位的亮度、边框对比度和文字安全区细节，`ui_contract_test.mjs` 检查槽位选择器与成品文件是否仍然存在。

每次生成先写入 `assets/generated/candidates/`，审查报告写入 `assets/generated/reviews/`。只有通过审查的候选图才会替换当前 `ui-art-table-v4.png`；失败结果会自动把具体问题加入下一次提示词。所有尝试都失败时，当前线上皮肤保持不变。

修改代码布局时先改 `ui-layout.json`，再运行：

```powershell
python tools/build_assets.py
node tools/ui_contract_test.mjs
node tools/smoke_test.mjs
```

## 推荐生成提示词

```text
Use case: ui-mockup
Asset type: 16:9 commercial strategy card-game UI master skin
Primary request: a premium image-heavy tabletop interface for an original identity strategy card game
Composition: symmetrical dark wood board; four framed opponent seats around the edges; large clean parchment play area in the center; wide ornate hand tray at the bottom; tall framed battle-log rail on the right; top phase plaque; reusable empty button and panel surfaces
Style: mature commercial game UI, dark carved wood, aged brass, oxblood lacquer, parchment, restrained cinematic lighting
Constraints: no characters, no cards, no icons, no readable text, no logos, no watermark; keep all functional regions empty and clearly separated; strong borders suitable for cropping and nine-slice scaling
Avoid: copied franchise assets, excessive decoration inside content zones, tiny details, asymmetrical functional layout
```

## 素材职责

- `skin-board.jpg`：全局桌面和选将背景
- `skin-player-frame.png`：武将与选将框
- `skin-card-frame.png`：手牌框体
- `skin-hand-tray.jpg`：手牌与操作区
- `skin-log-panel.jpg`：战局记录区
- `skin-phase-plaque.png`：阶段条和状态条
- `skin-modal.jpg`：身份、响应和结算弹窗
- `skin-button-*.png`：主按钮、次按钮和弱按钮状态

角色立绘继续通过绿幕源图与 `trim_green()` 输出透明 PNG；卡牌插画由 `assets/cards/card-art-sheet.png` 独立裁切，因此 UI 母版、角色和卡面可分别高强度替换。
