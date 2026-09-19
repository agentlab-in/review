export const OVERLAY_MARKER = "data-alab-review-overlay";

/** Client snippet injected in memory into served HTML only. Never written to disk. */
export function overlayScript(projectId: string, commentCount: number): string {
  const safeId = JSON.stringify(projectId);
  const safeCount = JSON.stringify(commentCount);
  return [
    `<div ${OVERLAY_MARKER}="bar" style="position:fixed;right:12px;bottom:12px;z-index:2147483647;font-family:system-ui,sans-serif;font-size:13px;background:#111;color:#fff;border-radius:8px;padding:8px 10px;box-shadow:0 2px 12px rgba(0,0,0,.4)">`,
    `<span ${OVERLAY_MARKER}="label"></span> `,
    `<button ${OVERLAY_MARKER}="toggle" type="button" style="margin-left:8px;cursor:pointer">comment: off</button>`,
    `</div>`,
    `<script ${OVERLAY_MARKER}="client">`,
    `(function(){`,
    `var projectId=${safeId};var count=${safeCount};var mode=false;`,
    `var bar=document.querySelector('[${OVERLAY_MARKER}="bar"]');`,
    `var label=document.querySelector('[${OVERLAY_MARKER}="label"]');`,
    `var toggle=document.querySelector('[${OVERLAY_MARKER}="toggle"]');`,
    `function paint(){label.textContent="review "+projectId+" ("+count+")";toggle.textContent="comment: "+(mode?"on":"off");}`,
    `toggle.addEventListener("click",function(ev){ev.stopPropagation();mode=!mode;paint();});`,
    `function cssPath(el){var parts=[];var node=el;while(node&&node.nodeType===1&&node.tagName.toLowerCase()!=="html"&&parts.length<6){if(node.id){parts.unshift("#"+node.id);break;}var tag=node.tagName.toLowerCase();var sib=node;var n=1;while((sib=sib.previousElementSibling)!=null){if(sib.tagName.toLowerCase()===tag){n++;}}parts.unshift(n>1?tag+":nth-of-type("+n+")":tag);node=node.parentElement;}return parts.join(" > ")||"body";}`,
    `document.addEventListener("click",function(ev){if(!mode)return;if(bar&&bar.contains(ev.target))return;ev.preventDefault();ev.stopPropagation();var el=ev.target;var raw=(el.innerText||el.textContent||"").replace(/\\s+/g," ").trim();var body=window.prompt("Review comment for <"+el.tagName.toLowerCase()+"> "+cssPath(el));if(!body)return;fetch("/__alab/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:window.location.pathname,selector:cssPath(el),tag:el.tagName.toLowerCase(),textSnippet:raw.slice(0,200),body:body})}).then(function(res){if(!res.ok){throw new Error("save failed");}count++;paint();}).catch(function(){window.alert("Could not save the comment. Is the review server running?");});},true);`,
    `paint();`,
    `})();`,
    `</scr` + `ipt>`,
  ].join("");
}

/** Inject the overlay into an HTML string in memory. Returns the served copy. */
export function injectOverlay(html: string, projectId: string, commentCount: number): string {
  const snippet = overlayScript(projectId, commentCount);
  const index = html.toLowerCase().lastIndexOf("</body>");
  if (index === -1) return html + snippet;
  return html.slice(0, index) + snippet + html.slice(index);
}
