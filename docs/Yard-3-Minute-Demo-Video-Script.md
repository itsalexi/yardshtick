# Yard — 3-Minute Demo Video Script

**Audience:** Hackathon judges  
**Format:** Live action, screen recording, and voice-over  
**Target runtime:** 3:00  
**Core message:** One photo turns a pile of objects into editable listings and a live, shareable garage sale.

## Script

| Time | Picture and action | Dialogue / voice-over | On-screen text |
|---|---|---|---|
| **0:00–0:07** | **Wide live-action shot.** A seller opens an overcrowded storage area. Boxes, gadgets, and household items fill the frame. They stare at the pile. | **Seller, to camera:** “I keep telling myself I’m going to sell all this.” | — |
| **0:07–0:18** | Quick close-ups: the seller photographs one object, starts typing a listing, searches for a price, then looks back at the whole pile. A rapid montage duplicates that process over several objects. | **Voice-over:** “But selling even one item means taking photos, figuring out what it is, writing a listing, and guessing a price. Then doing it all over again.” | `PHOTO · IDENTIFY · DESCRIBE · PRICE · REPEAT` |
| **0:18–0:27** | The seller lowers the phone and sighs. Cut to the Yard logo over the same storage scene. | **Voice-over:** “What if the whole pile could become a garage sale from just one photo? This is Yard.” | `YARD`  
`Sell everything you see.` |
| **0:27–0:39** | **Over-the-shoulder phone shot.** Open Yard’s camera. Frame six to ten clearly separated objects and tap the shutter. Keep the capture and transition into the screen recording continuous. | **Voice-over:** “Point Yard at a table, closet, room, or pile—and take a single photo.” | `One scene. One photo.` |
| **0:39–0:58** | **Full-screen app capture.** The scan begins. Numbered bounding boxes appear progressively over each sellable object. Refined masks or cutouts replace them as segmentation completes. Do not cut away during the first few detections. | **Voice-over:** “OpenAI vision understands the scene and finds the sellable objects. Rough boxes appear immediately, then SAM 2 isolates each item more precisely. If a mask fails, the box remains as a usable fallback, so the flow never stops.” | Small technical callouts:  
`OpenAI scene understanding`  
`Progressive object detection`  
`Roboflow SAM 2 segmentation`  
`Box fallback` |
| **0:58–1:12** | Tap one object to exclude it, then confirm the remaining items. Briefly show a missed or uncertain item being corrected only if that interaction is stable in the demo build. | **Voice-over:** “The seller stays in control. We can remove anything we don’t want to sell, correct an uncertain selection, and confirm the rest.” | `8 items found`  
`Tap to include or exclude` |
| **1:12–1:30** | Move into item review. Show a clean individual product image resolving from the original scene. Swipe or tap through two more detected products. | **Voice-over:** “From that one crowded photo, Yard creates individual product images and identifies each object—down to the brand and model when the evidence supports it.” | `Creating studio photo…` → `AI studio photo`  
Optional lower third: `Original scene stays private` |
| **1:30–1:49** | On one listing, place the cursor in the generated title and make a short edit. Change the condition once. Show the listing count, such as “2 / 8.” | **Voice-over:** “Every item becomes an editable listing. Yard prepares the title, condition, and product details, but everything can be reviewed and changed before it goes live.” | `Review item · 2 / 8`  
`Editable listing` |
| **1:49–2:08** | Scroll or pan to pricing. Select **Sell today**, then **Fair price**. Briefly highlight **Try your luck** and the comparable range. Leave the final choice on **Fair price**. | **Voice-over:** “Pricing is prepared too. Choose ‘Sell today’ for speed, ‘Fair price’ for balance, or ‘Try your luck’ for a higher ask. No researching every item from scratch.” | `SELL TODAY`  
`FAIR PRICE`  
`TRY YOUR LUCK` |
| **2:08–2:23** | Fast but readable montage through the remaining reviewed items. Tap **Publish**. Hold on the “You’re live!” screen with the public link and QR code. | **Voice-over:** “Once the listings look right, one tap publishes the entire sale—not just a draft, but a storefront ready to share.” | `YOU’RE LIVE!`  
`Share the link or scan the QR code.` |
| **2:23–2:39** | **Live-action two-device shot.** A buyer scans the QR code with a second phone. Cut to the buyer storefront: clean item photos, condition, prices, and availability. The original storage photo is nowhere on the page. | **Voice-over:** “Buyers scan the code, browse a clean storefront, and see only the individual products—not the seller’s private room or storage space.” | `BUYER VIEW`  
`Available now` |
| **2:39–2:51** | The buyer taps **Reserve**, enters a name, and confirms. Show the success message: “Reserved! See you at pickup.” | **Buyer:** “I’ll take this one.”  
**Voice-over:** “They reserve with just a name. No account and no payment required for the demo.” | `Reserved! See you at pickup.` |
| **2:51–3:00** | **Split screen.** Buyer item changes to **Reserved**; seller view updates live. End on the seller beside the now-marked storage pile, then the Yard logo. | **Voice-over:** “Convex pushes the reservation to the seller live. From one photo to a working garage sale—in under a minute. Yard: sell everything you see.” | `LIVE WITH CONVEX`  
`ONE PHOTO → LIVE GARAGE SALE`  
`YARD · Sell everything you see.` |

## Production Notes

- Use a rehearsed scene with six to ten visually separate, recognizable objects and at least four products Yard can identify precisely.
- Keep the capture-to-detection sequence continuous. This is the central proof that the result came from one scene photo.
- Record the seller and buyer devices together for the reservation moment, then use a split-screen insert so the live status change is unmistakable.
- Let important UI states remain visible for at least two seconds. Use punch-ins instead of moving through the screens too quickly.
- If processing needs to be shortened in the edit, label the speed change on screen. Do not present a sped-up result as real-time.
- Keep music restrained during the problem, lift it when the first boxes appear, and land the final logo on the reservation confirmation.

## Suggested Opening Props

Choose objects that read clearly on camera and give the AI a varied but fair scene: a game controller, headphones, a desk lamp, a small speaker, a camera, a keyboard, a pair of shoes, and a boxed appliance. Avoid heavy overlap, reflective plastic, and tiny accessories for the hero recording.
