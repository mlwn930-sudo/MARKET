"use client";
import { useState } from "react";
import { launchScenario } from "@/lib/launch-scenario";
const presets = [{name:"היקף מצומצם",units:15,price:55,fee:30},{name:"היקף ביניים",units:25,price:70,fee:30},{name:"היקף רחב",units:40,price:80,fee:25}];
const money = (n:number) => "$" + (n / 1e9).toFixed(2) + "B";
export function LaunchScenario() {
  const [units,setUnits] = useState(25), [price,setPrice] = useState(70), [fee,setFee] = useState(30);
  const result = launchScenario(units,price,fee);
  return <section className="scenario-lab" aria-labelledby="scenario-title">
    <div className="scenario-intro"><span className="micro-label">INTERACTIVE / ASSUMPTIONS, NOT FORECASTS</span><h3 id="scenario-title">מה משתנה כשההנחה משתנה?</h3><p>ניסוי רגישות פשוט למחזור מכירות אחד. הזיזו את ההנחות וראו מה נשאר למפיץ לפני עלויות. אף אחת מהאפשרויות אינה תחזית של MARKET או של Take-Two.</p></div>
    <div className="scenario-presets" aria-label="הנחות לדוגמה">{presets.map(p => <button type="button" key={p.name} aria-pressed={units===p.units && price===p.price && fee===p.fee} onClick={()=>{setUnits(p.units);setPrice(p.price);setFee(p.fee);}}>{p.name}</button>)}</div>
    <div className="scenario-grid"><div className="scenario-controls">
      <label htmlFor="scenario-units"><span>עותקים שנמכרו <output dir="ltr">{units}M</output></span><input id="scenario-units" type="range" min="5" max="60" step="1" value={units} aria-valuetext={`${units} מיליון עותקים`} onChange={e=>setUnits(Number(e.target.value))}/><small>5–60 מיליון · הנחת משתמש</small></label>
      <label htmlFor="scenario-price"><span>מחיר ממוצע ממומש <output dir="ltr">${price}</output></span><input id="scenario-price" type="range" min="40" max="100" step="1" value={price} aria-valuetext={`${price} דולר`} onChange={e=>setPrice(Number(e.target.value))}/><small>לפני עמלת פלטפורמה · אחרי הנחות ומסים עקיפים</small></label>
      <label htmlFor="scenario-fee"><span>עמלת הפצה משוערת <output dir="ltr">{fee}%</output></span><input id="scenario-fee" type="range" min="15" max="35" step="1" value={fee} aria-valuetext={`${fee} אחוזים`} onChange={e=>setFee(Number(e.target.value))}/><small>פישוט לצורכי המחשה · לא תנאי חוזה שפורסמו</small></label>
    </div><div className="scenario-result"><span className="micro-label">ILLUSTRATIVE PUBLISHER RECEIPTS</span><output className="scenario-total" dir="ltr" aria-live="polite" aria-atomic="true">{money(result.publisher)}</output><p>תקבולים מחושבים למפיץ, לפני עלויות</p><div className="scenario-waterfall" role="img" aria-label={`מכירות ${money(result.gross)}, עמלת הפצה ${money(result.platform)}, יתרה למפיץ ${money(result.publisher)}`}><div><span>מכירות</span><i style={{width:"100%"}}/><bdi>{money(result.gross)}</bdi></div><div><span>עמלת הפצה</span><i style={{width:`${fee}%`}}/><bdi>−{money(result.platform)}</bdi></div><div><span>יתרה למפיץ</span><i style={{width:`${100-fee}%`}}/><bdi>{money(result.publisher)}</bdi></div></div><p className="scenario-formula" dir="ltr">{units}M × ${price} × (1 − {fee}%)</p></div></div>
    <p className="scenario-caveat">זה אינו רווח, תזרים חופשי, הכנסות GAAP או Net Bookings מדווחים. המודל אינו כולל פיתוח, שיווק, תמלוגים, החזרים, מס הכנסה, עיתוי גבייה או הוצאות חוזרות של שחקנים. אין כאן מחיר יעד למניה.</p>
  </section>;
}
