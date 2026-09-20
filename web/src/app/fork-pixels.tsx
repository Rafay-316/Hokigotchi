// Original, code-drawn pixel art. No external assets or fonts are required.
import type { PetMood, PetStage } from "@/lib/fork-game";

export function HokiSprite({ stage, mood = "Curious", color = "#861f41", size = 128 }: { stage: PetStage; mood?: PetMood; color?: string; size?: number }) {
  if (stage === "egg") return <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#ba865a" d="M3 26h26v4H3zM6 24h20v2H6z"/>
    <path fill="#4b172b" d="M13 3h6v2h3v3h3v5h2v11h-3v3H8v-3H5V13h2V8h3V5h3z"/>
    <path fill="#fff1cf" d="M13 5h6v2h3v5h2v11h-3v2H10v-2H7V13h2V9h3V7h1z"/>
    <path fill="#e5751f" d="M12 8h4v4h-4zM19 16h4v4h-4zM9 21h4v3H9z"/>
    <path fill="#861f41" d="M15 17h3v3h-3zM20 9h2v3h-2z"/>
    <path fill="#fffaf0" d="M9 13h2v6H9z"/>
  </svg>;
  if (stage === "hatchling") return <svg width={size} height={size} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#4b172b" d="M10 10h13v3h3v10h-3v4H9v-3H6v-8h2v-4h2z"/>
    <path fill="#ba865a" d="M11 12h11v3h2v8h-3v2H10v-3H8v-5h3z"/>
    <path fill="#861f41" d="M13 8h3V6h3v3h2v3h-8z"/>
    <path fill="#fff8e9" d="M13 14h4v6h-4zM20 14h3v6h-3z"/>
    {mood === "Sleepy" ? <path fill="#2b1a23" d="M13 18h4v1h-4zM20 18h3v1h-3z"/> : mood === "Happy" ? <path fill="#2b1a23" d="M14 17h2v-1h1v3h-1v-1h-2zM20 17h2v-1h1v3h-1v-1h-2z"/> : <path fill="#2b1a23" d="M15 16h2v3h-2zM21 16h2v3h-2z"/>}
    <path fill="#e5751f" d="M21 20h6v2h-2v1h-4zM10 27h3v2h2v1H8v-2h2zM20 27h3v2h3v1h-8v-2h2z"/>
    <path fill={color} d="M10 22h10v4H10z"/>
    <path fill="#74452f" d="M7 20h3v2h2v2H8v-2H7z"/>
    <path fill="#f7c77d" d="M11 22h8v1h-8z"/>
  </svg>;
  return <Scout color={color} size={size} young={stage === "fledgling"} mood={mood} />;
}

export function Scout({ color = "#861f41", size = 64, young = false, mood = "Curious" }: { color?: string; size?: number; young?: boolean; mood?: PetMood }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" shapeRendering="crispEdges" aria-hidden="true">
    {/* Hoki's fan tail: original stepped feathers in maroon and orange. */}
    {young ? <><path fill="#4b172b" d="M4 13h5v3h4v10H6v-3H3v-7h1z"/><path fill="#e5751f" d="M5 15h3v4h3v4H6v-3H5z"/></> : <>
    <path fill="#4b172b" d="M6 5h4v2h3V3h5v4h4V5h4v5h3v5h2v6h-3v4H5v-3H2v-6H1v-5h3V7h2z" />
    <path fill="#e5751f" d="M6 7h3v3h3v7H8v-4H5V9h1zM14 5h3v9h-3zM23 7h2v5h2v5h-4zM3 13h3v4h4v4H5v-3H3zM26 18h3v3h-4v3h-4v-4h5z" />
    <path fill="#ca4f00" d="M10 10h3v7h-3zM18 9h3v8h-3zM7 21h5v3H7z" />
    <path fill="#f7c77d" d="M6 7h3v2H6zM14 5h3v2h-3zM23 7h2v2h-2zM3 13h2v2H3z" />
    </>}
    {/* Rounded body, crest and cheerful face. */}
    <path fill="#3d2025" d="M13 6h8v2h3v9h2v8h-3v3H10v-3H8v-7h3v-8h2z" />
    <path fill="#9c6544" d="M13 8h8v2h2v8H12v-7h1zM10 18h14v7H10z" />
    <path fill="#ba865a" d="M13 9h7v2h-6v5h-2v-5h1z" />
    <path fill="#861f41" d="M13 5h3V3h3v2h2v3h-8z" />
    <path fill="#fff8e9" d="M14 10h4v6h-4zM20 10h3v6h-3z" />
    {mood === "Sleepy" ? <path fill="#2b1a23" d="M14 14h4v1h-4zM20 14h3v1h-3z"/> : mood === "Happy" ? <path fill="#2b1a23" d="M14 13h1v-1h2v1h1v2h-1v-1h-2v1h-1zM20 13h1v-1h1v1h1v2h-1v-1h-1v1h-1z"/> : <>
    <path fill="#2b1a23" d="M16 12h2v3h-2zM21 12h2v3h-2z" />
    <path fill="#fff" d="M16 12h1v1h-1zM21 12h1v1h-1z" />
    </>}
    <path fill="#e5751f" d="M21 16h7v2h-2v2h-5z" />
    <path fill="#ffc66e" d="M22 16h5v1h-5z" />
    <path fill="#c64657" d="M21 20h3v3h-2v1h-2v-3h1z" />
    {/* Outfits recolor the jersey, keeping Hoki's feathers recognizable. */}
    <path fill={color} d="M11 19h9v5h3v2H11z" />
    <path fill="#f7c77d" d="M11 18h10v2H11zM16 21h2v3h-2zM18 22h2v2h-2z" />
    <path fill="#74452f" d="M9 19h3v2h2v3h-4v-2H9z" />
    <path fill="#e5751f" d="M12 28h3v2h2v1H9v-2h3zM21 28h3v2h3v1h-8v-2h2z" />
  </svg>;
}

export function Pixel({ kind, size = 24 }: { kind: "coin" | "star" | "flag" | "chest" | "heart" | "bolt" | "lock" | "check"; size?: number }) {
  const shapes = {
    coin: <><path fill="#714530" d="M5 1h6v2h2v10h-2v2H5v-2H3V3h2z"/><path fill="#ffc94e" d="M5 2h5v2h2v8h-2v2H5v-2H4V4h1z"/><path fill="#fff0ab" d="M5 3h2v8H5z"/><path fill="#d68c2d" d="M9 4h1v7H9z"/></>,
    star: <><path fill="#7d5527" d="M7 1h2v4h5v4h-3v5H8v-2H7v2H4V9H1V5h6z"/><path fill="#ffd569" d="M7 2h2v4h4v2h-3v4H9v-2H7v2H5V8H2V6h5z"/></>,
    flag: <><path fill="#4b172b" d="M3 1h2v13H3zM1 14h9v2H1z"/><path fill="#861f41" d="M5 2h9v6H5z"/><path fill="#e5751f" d="M7 3h2v3H7z"/></>,
    chest: <><path fill="#4a3244" d="M3 3h10v2h2v9H1V5h2z"/><path fill="#dc9860" d="M3 4h10v3H3zM2 9h12v4H2z"/><path fill="#ffce6a" d="M3 4h2v9H3zM11 4h2v9h-2zM7 7h2v4H7z"/></>,
    heart: <><path fill="#674158" d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z"/><path fill="#fa8f96" d="M2 3h3v2h6V3h3v6h-2v2h-2v2H6v-2H4V9H2z"/><path fill="#ffd2cf" d="M3 4h2v3H3z"/></>,
    bolt: <path fill="#ffc55b" stroke="#795832" strokeWidth="1" d="M8 1H5L3 9h4l-1 6 7-9H9l2-5z"/>,
    lock: <><path fill="#53576b" d="M4 1h8v2h2v11H2V3h2z"/><path fill="#c0c1c8" d="M5 2h6v5H5zM3 8h10v5H3z"/><path fill="#53576b" d="M6 3h4v4H6zM7 9h2v3H7z"/></>,
    check: <path fill="#861f41" d="M1 7h3v3h2V8h2V6h2V4h2V2h3v4h-2v2h-2v2H9v2H7v2H4v-2H2v-2H1z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">{shapes[kind]}</svg>;
}

export function Landscape() {
  return <svg viewBox="0 0 1000 460" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true" width="100%" height="100%">
    <defs><pattern id="hokigotchi-ground" width="40" height="32" patternUnits="userSpaceOnUse"><rect width="40" height="32" fill="#c99770"/><path d="M0 0h20v4H0zM24 16h16v4H24z" fill="#ab7656"/></pattern></defs>
    <rect width="1000" height="460" fill="#f8dfb9"/>
    <path fill="#e5751f" d="M431 51h54V35h48v16h28v28h16v48h-16v28h-28v16h-48v-16h-54v-28h-16V79h16z" />
    <path fill="#fffaf0" d="M100 60h44V44h56v16h28v18h22v22H72V78h28zM650 40h38V25h50v15h35v20h20v20H624V60h26zM884 128h28v-18h40v18h22v18h-112v-18z"/>
    <path fill="#c18b85" d="M0 267h70v-28h35v-44h44v-48h45v-35h60v35h38v48h35v44h48v90H0zM460 260h80v-52h40v-42h40v-54h44V79h53v33h45v54h34v42h55v135H460z"/>
    <path fill="#f3c899" d="M177 147h17v-35h60v35h17v32h-30v-18h-24v18h-40zM620 112h44V79h53v33h22v35h-33v-18h-28v19h-30v-15h-28z"/>
    <path fill="#9b4c60" d="M0 309h72v-29h69v-37h64v37h62v29h124v-40h70v-37h76v37h44v40h85v-30h76v-38h74v38h69v31h115v85H0z"/>
    <path fill="#bd734d" d="M0 351h110v-17h150v-24h180v-18h150v-33h173v-39h237v240H0z"/>
    <path fill="#e5751f" d="M0 344h110v-17h150v-24h180v-18h150v-33h173v-39h237v34H777v39H604v33H454v18H274v24H124v17H0z"/>
    <path fill="url(#hokigotchi-ground)" d="M0 403h110v-17h150v-24h180v-18h150v-33h173v-39h237v188H0z"/>
    <path fill="#861f41" d="M0 383h110v-17h150v-24h180v-18h150v-33h173v-39h237v24H777v39H604v33H454v18H274v24H124v17H0z"/>
    <path fill="#ffebc9" d="M76 373h73v-15h145v-25h162v-17h166v-30h166v-38h141v8H796v39H630v30H464v18H302v25H157v15H76z"/>
    <g fill="#ca4f00"><path d="M26 304h15v-13h18v13h15v33H26zM902 182h18v-19h25v19h18v52h-61zM346 246h18v-16h20v16h17v52h-55z"/></g>
    <g fill="#624032"><path d="M45 326h10v23H45zM924 223h12v27h-12zM368 283h12v30h-12z"/></g>
    <g fill="#f9d774"><path d="M304 275h8v-8h8v8h8v8h-8v8h-8v-8h-8zM739 217h8v-8h8v8h8v8h-8v8h-8v-8h-8z"/></g>
    <g fill="#861f41"><path d="M217 350h5v-5h6v5h5v5h-5v5h-6v-5h-5zM515 329h6v-5h6v5h6v5h-6v5h-6v-5h-6z"/></g>
    <g fill="#b9b5ad"><path d="M817 145h20v-30h20v30h20v-30h20v30h20v-30h20v103H817z"/></g>
    <path fill="#898589" d="M817 153h120v12H817zM817 209h120v9H817z"/>
    <path fill="#572539" d="M860 184h24v34h-24zM830 164h8v17h-8zM917 164h8v17h-8z"/>
    <path fill="#861f41" d="M827 102h18V88h6v14h18v13h-42zM897 102h18V88h6v14h18v13h-42z"/>
  </svg>;
}
