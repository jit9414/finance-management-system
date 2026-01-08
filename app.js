/* ======================================
GOOGLE SHEET CONFIG
====================================== */
const API_URL = "https://script.google.com/macros/s/AKfycbx1NXSYyRWFM0n061Q-Mk4PUT20cLp0diOjwVYZcYk3FkcLbtxckddUmXQNpxTb_7NBAg/exec";

/* ======================================
GLOBAL STATE
====================================== */
let accountMode = "add";       // add | view | update
let currentAccount = null;
let emiSchedule = [];
let refCount = 0;

/* ======================================
DATE UTILS
====================================== */
function formatDMY(d){
  if(!d) return "";
  const x = new Date(d);
  return String(x.getDate()).padStart(2,"0")+"/"+
         String(x.getMonth()+1).padStart(2,"0")+"/"+
         x.getFullYear();
}

function parseDDMMYYYY(s){
  if(!s) return null;
  const p = s.split("/");
  if(p.length!==3) return null;
  return new Date(p[2],p[1]-1,p[0]);
}

function calcDelayDays(due, paid){
  const d1 = new Date(due.getFullYear(),due.getMonth(),due.getDate());
  const d2 = new Date(paid.getFullYear(),paid.getMonth(),paid.getDate());
  return Math.round((d2-d1)/(1000*60*60*24));
}

/* ======================================
API CALL HELPER
====================================== */
async function callAPI(action, payload = {}){

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: action,
      data: payload
    })
  });

  if(!response.ok){
    throw new Error("API error " + response.status);
  }

  return await response.json();
}

/* ======================================
FINANCE
====================================== */
async function loadFinanceList(){
  const res = await callAPI("GET_FINANCES");
  if(!res.success) return alert("Finance load failed");

  financeSelect.innerHTML =
    `<option value="">-- Select Finance --</option>`;

  res.data.forEach(f=>{
    financeSelect.innerHTML +=
      `<option value="${f.financeId}">${f.financeName}</option>`;
  });
}

async function addFinance(){

  if(!fname.value){
    alert("Finance name required");
    return;
  }

  const res = await callAPI("ADD_FINANCE",{
    financeName: fname.value,
    mobile: fmobile.value,
    address: faddress.value
  });

  if(!res.success) return alert(res.message);

  alert("Finance saved");
  fname.value = fmobile.value = faddress.value = "";
  loadFinanceList();
}

async function openEditFinancePopup(){

  if(!financeSelect.value){
    alert("Select finance first");
    return;
  }

  const res = await callAPI("GET_FINANCE_BY_ID",{
    financeId: financeSelect.value
  });

  if(!res.success) return alert("Finance load failed");

  const f = res.data;

  ef_name.value = f.financeName;
  ef_mobile.value = f.mobile;
  ef_address.value = f.address;

  ef_name.disabled = false;
  ef_mobile.disabled = false;
  ef_address.disabled = false;

  document.querySelector("#editFinancePopup button[onclick='updateFinance()']").style.display="inline-block";
  document.querySelector("#editFinancePopup button[onclick='deleteFinance()']").style.display="inline-block";

  editFinancePopup.style.display="flex";
}

async function openViewFinancePopup(){

  if(!financeSelect.value){
    alert("Select finance first");
    return;
  }

  const res = await callAPI("GET_FINANCE_BY_ID",{
    financeId: financeSelect.value
  });

  if(!res.success) return alert("Finance load failed");

  const f = res.data;

  ef_name.value = f.financeName;
  ef_mobile.value = f.mobile;
  ef_address.value = f.address;

  ef_name.disabled = true;
  ef_mobile.disabled = true;
  ef_address.disabled = true;

  document.querySelector("#editFinancePopup button[onclick='updateFinance()']").style.display="none";
  document.querySelector("#editFinancePopup button[onclick='deleteFinance()']").style.display="none";

  editFinancePopup.style.display="flex";
}

async function updateFinance(){

  const res = await callAPI("UPDATE_FINANCE",{
    financeId: financeSelect.value,
    financeName: ef_name.value,
    mobile: ef_mobile.value,
    address: ef_address.value
  });

  if(!res.success) return alert(res.message);

  alert("Finance updated");
  closeEditFinancePopup();
  loadFinanceList();
}

async function deleteFinance(){

  if(!confirm("Delete this finance?")) return;

  const res = await callAPI("DELETE_FINANCE",{
    financeId: financeSelect.value
  });

  if(!res.success) return alert(res.message);

  alert("Finance deleted");
  closeEditFinancePopup();
  loadFinanceList();
}

function closeEditFinancePopup(){
  editFinancePopup.style.display="none";
}

/* ======================================
DASHBOARD
====================================== */
function selectFinance(){
  if(!financeSelect.value) return alert("Select finance");
  mainDashboard.style.display="none";
  financeDashboard.style.display="block";
  loadCustomerList();
}

function backToMain(){
  financeDashboard.style.display="none";
  mainDashboard.style.display="block";
}

/* ======================================
ACCOUNT POPUP
====================================== */
function openAddAccount(){
  accountMode="add";
  currentAccount=null;
  clearAccountForm();
  enableForm(true);
  accountPopup.style.display="flex";
}

function openViewAccount(){
  if(!currentAccount) return alert("Select account");
  accountMode="view";
  fillAccountForm(currentAccount);
  enableForm(false);
  accountPopup.style.display="flex";
}

function openUpdateAccount(){
  if(!currentAccount) return alert("Select account");
  accountMode="update";
  fillAccountForm(currentAccount);
  enableForm(true);
  accountPopup.style.display="flex";
}

function closeAccountPopup(){
  accountPopup.style.display="none";
}

/* ======================================
EMI ENGINE
====================================== */
function generateEmiTable(){

  emiSchedule = [];

  const amt = Number(emiAmount.value);
  const tenure = Number(emiTenure.value);
  const start = new Date(emiStartDate.value);

  if(!amt || !tenure || !emiStartDate.value){
    alert("Fill EMI details");
    return;
  }

  const tbody = emiTable.querySelector("tbody");
  tbody.innerHTML="";

  for(let i=0;i<tenure;i++){
    const due = new Date(start);
    due.setMonth(start.getMonth()+i);

    const e = {
      emiNo:i+1,
      dueDate:due,
      dueAmount:amt,
      paidAmount:0,
      receivedDate:"",
      receiptNo:"",
      issuedBy:"",
      mode:"Cash",
      delayDays:0
    };

    emiSchedule.push(e);
    tbody.innerHTML += buildEmiRow(e,i);
  }

  emiTableCard.style.display="block";
  updateSummary();
}

function buildEmiRow(e,i){
  return `
<tr data-i="${i}">
<td>${e.emiNo}</td>
<td>${new Date(e.dueDate).toLocaleString("en-IN",{month:"long",year:"numeric"})}</td>
<td>${formatDMY(e.dueDate)}</td>
<td>${e.dueAmount}</td>
<td><input type="number" value="${e.paidAmount}" oninput="handlePayment(this)"></td>
<td><input value="${e.receivedDate}" placeholder="dd/mm/yyyy" oninput="handlePayment(this)"></td>
<td><input value="${e.receiptNo}" oninput="handlePayment(this)"></td>
<td>
<select onchange="handlePayment(this)">
<option ${e.mode==="Cash"?"selected":""}>Cash</option>
<option ${e.mode==="Bank"?"selected":""}>Bank</option>
</select>
</td>
<td><input value="${e.issuedBy}" oninput="handlePayment(this)"></td>
<td class="delayCell">${e.delayDays}</td>
</tr>`;
}

function handlePayment(el){

  const row = el.closest("tr");
  const i = Number(row.dataset.i);
  const inputs = row.querySelectorAll("input");
  const select = row.querySelector("select");

  const e = emiSchedule[i];

  e.paidAmount = Number(inputs[0].value||0);
  e.receivedDate = inputs[1].value;
  e.receiptNo = inputs[2].value;
  e.issuedBy = inputs[3].value;
  e.mode = select.value;

  const paidDate = parseDDMMYYYY(e.receivedDate);
  if(paidDate){
    e.delayDays = calcDelayDays(new Date(e.dueDate), paidDate);
  }

  updateRowUI(i);
  updateSummary();
}

function updateRowUI(i){
  const row = document.querySelector(`#emiTable tr[data-i="${i}"]`);
  const e = emiSchedule[i];
  row.querySelector(".delayCell").innerText =
    e.delayDays>0?`+${e.delayDays}`:e.delayDays;

  if(e.paidAmount>=e.dueAmount){
    row.style.background="#d1fae5";
  }else if(e.paidAmount>0){
    row.style.background="#fef3c7";
  }else{
    row.style.background="";
  }
}

function updateSummary(){

  let total=0, received=0, expected=0;
  const today = new Date();

  emiSchedule.forEach(e=>{
    total+=e.dueAmount;
    received+=Number(e.paidAmount||0);
    if(today>=new Date(e.dueDate)) expected+=e.dueAmount;
  });

  totalEmi.innerText = total;
  totalReceived.innerText = received;
  pendingAmt.innerText = total-received;
  expectedTill.innerText = received-expected;
}

/* ======================================
ACCOUNT SAVE / LOAD
====================================== */
function buildAccountFromForm(){
  return {
    accountNo: accNo.value,
    financeId: financeSelect.value,
    customer:{
      name:cname.value,
      father:cfather.value,
      mobile:cmobile.value,
      altMobile:caltmobile.value,
      address:caddress.value,
      remark:cremark.value
    },
    vehicle:{
      model:vmodel.value,
      color:vcolor.value,
      frame:vframe.value,
      engine:vengine.value,
      reg:vreg.value,
      remark:vremark.value
    },
    references: collectReferences(),
    emi:{
      setup:{
        amount:Number(emiAmount.value||0),
        tenure:Number(emiTenure.value||0),
        startDate:emiStartDate.value
      },
      schedule:emiSchedule,
      summary:{
        totalEmi:Number(totalEmi.innerText),
        totalReceived:Number(totalReceived.innerText),
        pending:Number(pendingAmt.innerText),
        expectedTill:Number(expectedTill.innerText),
        remark:emiRemark.value
      }
    }
  };
}

async function saveAccountUnified(){

  if(!accNo.value) return alert("Account No required");

  const res = await callAPI("SAVE_ACCOUNT", buildAccountFromForm());

  if(!res.success) return alert(res.message);

  alert("Account saved");
  closeAccountPopup();
  loadCustomerList();
}

async function loadCustomerList(){

  customerList.innerHTML="";

  const res = await callAPI("GET_ACCOUNTS",{
    financeId: financeSelect.value
  });

  if(!res.success) return;

  accountCount.innerText = res.data.length;

  res.data.forEach(acc=>{
    const li = document.createElement("li");
    li.innerHTML = `<b>${acc.accountNo}</b> - ${acc.customer.name}`;
    li.onclick = ()=>{
      currentAccount = acc;
      customerActionBar.style.display="block";
      selectedCustomerName.innerText =
        `👤 ${acc.customer.name} (${acc.accountNo})`;
    };
    customerList.appendChild(li);
  });
}

/* ======================================
REFERENCES
====================================== */
function addReference(){
  if(refCount >= 2){
    alert("Max 2 reference allowed");
    return;
  }
  refCount++;

  const box = document.createElement("div");
  box.className = "ref-box";

  box.innerHTML = `
    <input placeholder="Name">
    <input placeholder="Father">
    <input placeholder="Mobile">
    <textarea placeholder="Address"></textarea>
  `;

  referenceContainer.appendChild(box);
}

function collectReferences(){
  const refs=[];
  document.querySelectorAll("#referenceContainer .ref-box")
    .forEach(b=>{
      const i=b.querySelectorAll("input,textarea");
      refs.push({
        name:i[0].value,
        father:i[1].value,
        mobile:i[2].value,
        address:i[3].value
      });
    });
  return refs;
}

/* ======================================
FORM HELPERS
====================================== */
function clearAccountForm(){
  document.querySelectorAll("#accountPopup input,#accountPopup textarea")
    .forEach(e=>e.value="");
  referenceContainer.innerHTML="";
  refCount=0;
  emiSchedule=[];
  emiTableCard.style.display="none";
}

function fillAccountForm(a){
  accNo.value=a.accountNo;
  cname.value=a.customer.name;
  cfather.value=a.customer.father;
  cmobile.value=a.customer.mobile;
  caltmobile.value=a.customer.altMobile;
  caddress.value=a.customer.address;
  cremark.value=a.customer.remark;

  vmodel.value=a.vehicle.model;
  vcolor.value=a.vehicle.color;
  vframe.value=a.vehicle.frame;
  vengine.value=a.vehicle.engine;
  vreg.value=a.vehicle.reg;
  vremark.value=a.vehicle.remark;

  referenceContainer.innerHTML="";
  (a.references||[]).forEach(r=>{
    addReference();
    const i=referenceContainer.lastElementChild.querySelectorAll("input,textarea");
    i[0].value=r.name;
    i[1].value=r.father;
    i[2].value=r.mobile;
    i[3].value=r.address;
  });

  emiAmount.value=a.emi.setup.amount;
  emiTenure.value=a.emi.setup.tenure;
  emiStartDate.value=a.emi.setup.startDate;
  emiRemark.value=a.emi.summary.remark;

  emiSchedule=a.emi.schedule||[];
  renderEmiFromSchedule();
}

function enableForm(enable){
  document.querySelectorAll("#accountPopup input,#accountPopup textarea,#accountPopup select")
    .forEach(e=>e.disabled=!enable);
  accNo.disabled = accountMode!=="add";

}

function renderEmiFromSchedule(){

  const tbody = emiTable.querySelector("tbody");
  tbody.innerHTML = "";

  emiSchedule.forEach((e,i)=>{
    tbody.innerHTML += buildEmiRow(e,i);
    updateRowUI(i);
  });

  emiTableCard.style.display = emiSchedule.length ? "block" : "none";
  updateSummary();
}




