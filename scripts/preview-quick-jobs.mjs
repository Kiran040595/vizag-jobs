// Isolated browser fixture: never creates users, jobs or applications in Supabase.
import { createServer } from "vite";
import { FORM_TEMPLATES } from "../src/lib/quickApply.js";
const fixture = {
  id: "00000000-0000-0000-0000-000000000010",
  form_id: "00000000-0000-0000-0000-000000000011",
  slug: "delivery-preview",
  title: "Delivery boys in Vizag",
  role: "Delivery",
  company: "Jobs in Vizag Recruitment",
  location: "Vizag",
  salary: "₹15,000–₹20,000 / month",
  description:
    "Deliver orders around Vizag. Flexible shifts available. Choose your preferred shift below.",
  is_open: true,
  fields: [
    ...FORM_TEMPLATES.Delivery,
    {
      id: "shifts",
      label: "Preferred shifts",
      type: "checkbox",
      options: ["Morning", "Evening"],
      required: true,
    },
  ],
};
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom';import '/src/index.css';import {supabase,supabasePublic} from '/src/lib/supabaseClient.js';import {AdminAuthContext} from '/src/context/adminAuthContext.js';import QuickApplyPage from '/src/pages/QuickApplyPage.jsx';import AdminQuickJobPage from '/src/pages/AdminQuickJobPage.jsx';
const fixture=${JSON.stringify(fixture)};
const from=table=>{const result={data:table==='employer_profiles'?[{user_id:'company-preview',company_name:'Preview employer'}]:table==='jobs'?{slug:fixture.slug}:[],error:null};const chain=new Proxy({}, {get:(_,key)=>key==='then'?(resolve)=>Promise.resolve(result).then(resolve):()=>chain});return chain;};
supabase.from=from;supabase.rpc=async(name)=>({data:name==='save_quick_job'?fixture.id:fixture,error:null});supabasePublic.rpc=supabase.rpc;supabase.auth.getSession=async()=>({data:{session:null}});
const originalFetch=window.fetch;window.fetch=(url,options)=>String(url)==='/api/quick-apply'?Promise.resolve(new Response(JSON.stringify({accepted:true,claimable:true}),{status:200,headers:{'Content-Type':'application/json'}})):originalFetch(url,options);
const h=React.createElement;createRoot(document.getElementById('root')).render(h(BrowserRouter,null,h(AdminAuthContext.Provider,{value:{user:{email:'preview@example.invalid'},signOut:()=>{}}},h('div',{className:'bg-amber-100 px-4 py-2 text-sm'},'Local test fixture · no production data'),h(Routes,null,h(Route,{path:'/_quick-test/apply/:slug',element:h(QuickApplyPage)}),h(Route,{path:'/_quick-test/admin',element:h(AdminQuickJobPage)})))));`;
const server = await createServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "quick-browser-fixture",
      enforce: "pre",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (
            req.url?.startsWith("/_quick-test/") &&
            !req.url.endsWith(".jsx")
          ) {
            res.setHeader("Content-Type", "text/html");
            res.end(
              await server.transformIndexHtml(
                req.url,
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/_quick-fixture.jsx"></script></body></html>',
              ),
            );
            return;
          }
          next();
        });
      },
      resolveId(id) {
        if (id === "/_quick-fixture.jsx") return "\0quick-fixture.jsx";
      },
      load(id) {
        if (id === "\0quick-fixture.jsx") return source;
      },
    },
  ],
});
await server.listen();
console.log(
  "Quick-job fixtures: http://127.0.0.1:5174/_quick-test/apply/delivery-preview and /_quick-test/admin",
);
