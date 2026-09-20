"use client";

import { OUTFITS, PET_STAGES, petStatus } from "@/lib/fork-game";
import type { Game } from "@/lib/fork-game";
import { dispatchGame } from "./fork-game-store";
import { HokiSprite, Pixel } from "./fork-pixels";
import styles from "./fork-quest.module.css";

export default function HokiNest({ game, day, openQuests, openRewards }: {
  game: Game; day: string; openQuests: () => void; openRewards: () => void;
}) {
  const pet = petStatus(game, day);
  const color = OUTFITS.find((outfit) => outfit.id === game.outfit)!.color;
  const isEgg = pet.stage.id === "egg";
  const checkinDone = game.days[day]?.checkin ?? false;
  return <section className={styles.petSection} aria-label="Hoki's nest">
    <div className={styles.petHeading}><div><p className={styles.eyebrow}>YOUR HABITS HAVE A LITTLE HEARTBEAT.</p><h1>{isEgg ? "A little egg. A big beginning." : "Hey, Hoki."}</h1><p>Log spending, plan your week, and reach savings milestones to help Hoki grow.</p></div><span className={styles.dailyTag}>{pet.stage.name.toUpperCase()}</span></div>
    <div className={styles.petGrid}>
      <div className={styles.petDevice}>
        <div className={styles.petDeviceLabel}><b>HOKIGOTCHI</b><span>HOME SWEET HOLLOW</span></div>
        <div className={styles.petScreen}>
          <span className={styles.petMood}>{pet.mood}</span>
          <div className={styles.petCloud} aria-hidden="true" />
          <div className={styles.petHills} aria-hidden="true" />
          <div className={styles.petPlatform} aria-hidden="true" />
          <div className={styles.petSprite} data-mood={pet.mood} key={`${pet.stage.id}-${game.pet.lastFed}`}>
            <HokiSprite stage={pet.stage.id} mood={pet.mood} color={color} size={160} />
            {pet.mood === "Happy" && <span className={styles.petHearts} aria-hidden="true"><Pixel kind="heart" size={24}/><Pixel kind="heart" size={18}/></span>}
          </div>
          <p className={styles.petSpeech}>{pet.message}</p>
        </div>
        <div className={styles.petControls}>
          <button className={styles.smallButton} onClick={openQuests}>{isEgg ? "Hatch with a money quest" : "Grow with a money quest"}</button>
          <button className={styles.smallButton} onClick={() => dispatchGame({ type: "feed" })} disabled={!pet.canFeed} aria-describedby="feeding-help">{pet.fedToday ? "Fed today" : "Feed Hoki · 1 snack"}</button>
          <button className={styles.smallButton} onClick={openRewards}>Dress up</button><button className={styles.smallButton} onClick={() => dispatchGame({ type: "checkin" })} disabled={checkinDone}>{checkinDone ? "Checked in today" : "Daily check-in · +10 XP"}</button>
        </div>
      </div>
      <div className={styles.petCare}>
        <section className={styles.panel} aria-label="Pet care">
          <div className={styles.panelTitle}><h2>A little care goes a long way.</h2><Pixel kind="heart" size={26}/></div>
          <div className={styles.petSnackRow}><div><small>YOUR SNACK BAG</small><strong>{game.pet.snacks}<span> / 99</span></strong></div><span className={styles.petSnack} aria-hidden="true">✦</span></div>
          <p className={styles.muted}>Each quest action that earns XP also earns one snack. Feeding uses snacks, so your outfit tokens stay yours.</p>
          <div className={styles.petMeterLabel}><span>Fullness</span><b>{isEgg ? "Cozy in the egg" : `${pet.fullness}%`}</b></div>
          <progress value={isEgg ? 100 : pet.fullness} max="100" aria-label={isEgg ? "Egg comfort" : "Hoki fullness"}/>
          <p id="feeding-help" className={styles.muted}>{pet.feedReason}</p>
          <p className={styles.petCareNote}>One feeding per day. Hoki can get sleepy or peckish, but never loses an evolution. Come back whenever you're ready.</p>
          <button className={styles.textButton} onClick={openQuests}>Earn snacks with money habits <span>→</span></button>
        </section>
        <section className={styles.panel} aria-label="Hoki evolution">
          <div className={styles.panelTitle}><h2>Growing together.</h2><span className={styles.xpTag}>{game.xp} LIFETIME XP</span></div>
          <ol className={styles.evolutionTrack}>{PET_STAGES.map((stage) => <li key={stage.id} data-unlocked={game.xp >= stage.xp} aria-current={pet.stage.id === stage.id ? "step" : undefined}>
            <HokiSprite stage={stage.id} color={color} size={40}/><strong>{stage.name}</strong><small>{stage.xp} XP</small>
          </li>)}</ol>
          <progress value={pet.progress} max={pet.progressMax} aria-label="Progress toward Hoki's next evolution"/>
          <p className={styles.muted}>{pet.nextStage ? `${pet.nextStage.xp - game.xp} more XP to ${pet.nextStage.name.toLowerCase()}.` : "Your campus champion is fully grown. Keep exploring quests, outfits, and the world map."}</p>
        </section>
      </div>
    </div>
  </section>;
}
