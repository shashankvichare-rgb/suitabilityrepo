(function(root) {
  'use strict';
  const insuranceCatalogue = [
    {id:'accident',name:'Personal Accident / Accidental Death',short:'Personal Accident',icon:'✦',description:'Lump sum on accidental death, subject to policy terms.'},
    {id:'emi',name:'EMI Protect',short:'EMI Protect',icon:'▥',description:'Eligible EMI payments during hospitalization, subject to limits. This is not unemployment cover.'},
    {id:'hospi',name:'Hospi Cash',short:'Hospi Cash',icon:'✚',description:'Hospitalization cash benefit. Workbook cover is not confirmed as a daily amount.'},
    {id:'cyber',name:'Cyber Protection',short:'Cyber Protection',icon:'⌁',description:'Cover for eligible unauthorized UPI losses due to cyber incidents.'},
    {id:'vector',name:'Vector-Borne Disease',short:'Vector-Borne Disease',icon:'◌',description:'Support for hospitalization due to covered vector-borne illnesses.'}
  ];
  const fields = [
    ['Life stage', [['name','Customer name','text'],['age','Age','number',18,100],['gender','Gender',['Man','Woman','Other']],['marital','Marital status',['Single','Married']],['dependants','Dependants','number',0,20],['children','Children','number',0,20]]],
    ['Livelihood', [['livelihood','Employment',['Salaried','Self-employed']],['income','Monthly income','number',1,100000000],['businessOwner','Business owner',['No','Yes']],['msme','MSME',['No','Yes']],['incomeStability','Income pattern',['Stable','Variable']],['singleIncome','Single-income household',['No','Yes']]]],
    ['Loan', [['loanType','Loan type',['Personal loan','Business loan','Home loan']],['loanAmount','Loan amount','number',1,100000000],['tenure','Tenure (months)','number',1,600],['emi','Monthly EMI','number',0,100000000]]],
    ['Geography', [['city','City','text'],['tier','City tier',['Tier 1','Tier 2','Tier 3']],['vector','Vector-borne exposure',['Low','Medium','High']],['seasonal','Illustrative seasonal risk',['No','Yes']]]],
    ['Relationship / behaviour', [['borrower','Borrower relationship',['New','Repeat']],['digital','Digital-first',['No','Yes']],['upi','UPI usage',['Low','Medium','High']],['transactions','Online transactions',['Low','Medium','High']],['health','Health exposure',['Low','High']],['healthIndicator','Existing relevant health indicator',['No','Yes']]]]
  ];
  const base = {name:'Demo',age:27,gender:'Man',marital:'Single',dependants:0,children:0,livelihood:'Salaried',income:100000,businessOwner:'No',msme:'No',incomeStability:'Stable',singleIncome:'No',loanType:'Personal loan',loanAmount:500000,tenure:12,emi:10000,city:'Mumbai',tier:'Tier 1',vector:'Low',seasonal:'No',borrower:'New',digital:'Yes',upi:'Low',transactions:'Low',health:'Low',healthIndicator:'No'};
  const demoProfiles = {
    Rohit:{...base,name:'Rohit',age:29,marital:'Married',dependants:1,income:70000,tenure:24,emi:23500,upi:'High',transactions:'High'},
    Meena:{...base,name:'Meena',age:37,gender:'Woman',marital:'Married',dependants:2,children:1,livelihood:'Self-employed',income:70000,businessOwner:'Yes',incomeStability:'Variable',loanType:'Business loan',tenure:36,emi:18000,city:'Jaipur',tier:'Tier 2',vector:'Medium',digital:'No',upi:'Medium',transactions:'Medium'},
    Rajesh:{...base,name:'Rajesh',age:48,marital:'Married',dependants:3,children:2,livelihood:'Self-employed',income:70000,businessOwner:'Yes',incomeStability:'Variable',tenure:36,emi:18000,city:'Patna',tier:'Tier 2',vector:'High',borrower:'Repeat',digital:'No',health:'High'},
    Priya:{...base,name:'Priya',age:34,gender:'Woman',dependants:1,livelihood:'Self-employed',income:85000,businessOwner:'Yes',msme:'Yes',incomeStability:'Variable',loanType:'Business loan',tenure:24,emi:25000,city:'Bengaluru',upi:'High',transactions:'High'}
  };
  const r=(label,points,when)=>({label,points,when});
  const suitabilityRules = {
    accident:[r('Self-employed',25,p=>p.livelihood==='Self-employed'),r('Business owner',15,p=>p.businessOwner==='Yes'),r('Variable income',10,p=>p.incomeStability==='Variable'),r('At least one dependant',15,p=>p.dependants>=1),r('Three or more dependants',5,p=>p.dependants>=3),r('Business loan',15,p=>p.loanType==='Business loan'),r('Tenure ≥24 months',10,p=>p.tenure>=24),r('Tenure ≥36 months',5,p=>p.tenure>=36),r('Age 25–50',10,p=>p.age>=25&&p.age<=50),r('Salaried',-10,p=>p.livelihood==='Salaried')],
    emi:[r('Salaried',20,p=>p.livelihood==='Salaried'),r('EMI / income ≥20%',15,p=>p.emi>=p.income*.2),r('EMI / income ≥30%',15,p=>p.emi>=p.income*.3),r('EMI / income ≥40%',10,p=>p.emi>=p.income*.4),r('Tenure ≥12 months',10,p=>p.tenure>=12),r('Tenure ≥24 months',10,p=>p.tenure>=24),r('Tenure ≥36 months',5,p=>p.tenure>=36),r('Personal loan',15,p=>p.loanType==='Personal loan'),r('At least one dependant',10,p=>p.dependants>=1),r('Single-income household',10,p=>p.singleIncome==='Yes'),r('EMI / income <10%',-15,p=>p.emi<p.income*.1)],
    hospi:[r('Age 35–44',10,p=>p.age>=35&&p.age<=44),r('Age 45–54',20,p=>p.age>=45&&p.age<=54),r('Age 55+',30,p=>p.age>=55),r('At least one dependant',10,p=>p.dependants>=1),r('Self-employed',15,p=>p.livelihood==='Self-employed'),r('Variable income',15,p=>p.incomeStability==='Variable'),r('Higher health exposure',20,p=>p.health==='High'),r('Repeat borrower',10,p=>p.borrower==='Repeat'),r('Tenure ≥24 months',10,p=>p.tenure>=24),r('Existing relevant health indicator',15,p=>p.healthIndicator==='Yes')],
    cyber:[r('Digital-first',25,p=>p.digital==='Yes'),r('High UPI usage',25,p=>p.upi==='High'),r('Medium UPI usage',15,p=>p.upi==='Medium'),r('High online transactions',20,p=>p.transactions==='High'),r('Age 18–40',10,p=>p.age>=18&&p.age<=40),r('Salaried',5,p=>p.livelihood==='Salaried'),r('Tier 1/2 urban',5,p=>p.tier!=='Tier 3'),r('Low digital activity',-30,p=>p.digital==='No'&&p.upi==='Low'&&p.transactions==='Low')],
    vector:[r('High illustrative vector exposure',35,p=>p.vector==='High'),r('Medium illustrative vector exposure',20,p=>p.vector==='Medium'),r('Illustrative seasonal risk',15,p=>p.seasonal==='Yes'),r('Tier 2/3',10,p=>p.tier!=='Tier 1'),r('At least one dependant',5,p=>p.dependants>=1),r('Relevant health exposure',15,p=>p.health==='High'),r('Low illustrative vector exposure',-15,p=>p.vector==='Low')]
  };
  const categories = {1:'Financial/Livelihood',2:'Preventive Health',3:'Healthcare Access',4:'Preventive Health',5:'Preventive Health',6:'Financial/Livelihood',7:'Financial/Livelihood',8:'Women’s Health',9:'Lifestyle/Development',10:'Healthcare Access',11:'Preventive Health',12:'Healthcare Access',13:'Healthcare Access',14:'Lifestyle/Development',15:'Healthcare Access',16:'Lifestyle/Development',17:'Lifestyle/Development',18:'Healthcare Access',19:'Vector/Environmental',20:'Vector/Environmental',21:'Vector/Environmental',22:'Digital/Identity',23:'Digital/Identity',24:'Digital/Identity',25:'Digital/Identity',26:'Digital/Identity'};
  const bundleRules = {accident:[[3,10]],hospi:[[10,15],[12,15]],emi:[[1,15]],cyber:[[26,20],[25,20],[22,15]],vector:[[19,20],[20,20]]};
  const vasRules = [
    {label:'Self-employed / MSME',when:p=>p.livelihood==='Self-employed'||p.msme==='Yes',weights:[[6,40],[7,35],[1,25],[3,15],[16,10]]},
    {label:'Digital-first',when:p=>p.digital==='Yes',weights:[[26,40],[25,35],[22,30],[24,20],[23,15]]},
    // Numeric weights below are explicit demo configuration where the brief supplies priorities only.
    {label:'Higher health exposure (demo weighting)',when:p=>p.health==='High'||p.healthIndicator==='Yes',weights:[[5,40],[4,35],[3,30],[10,25],[12,20],[15,15]]},
    {label:'Age 45+ preventive priority (demo weighting)',when:p=>p.age>=45,weights:[[5,30],[4,25],[2,15],[11,10]]},
    {label:'Age 55+ preventive priority (demo weighting)',when:p=>p.age>=55,weights:[[5,10],[4,10]]},
    {label:'Women’s health',when:p=>p.gender==='Woman',weights:[[8,35],[2,15],[3,10],[5,10]]},
    {label:'High illustrative vector exposure',when:p=>p.vector==='High',weights:[[20,40],[19,35],[21,25],[3,20],[12,10]]},
    {label:'Medium illustrative vector exposure (demo weighting)',when:p=>p.vector==='Medium',weights:[[20,20],[19,18],[21,13],[3,10],[12,5]]}
  ];
  const config={insuranceCatalogue,suitabilityRules,vasRules,bundleRules,categories,fields,demoProfiles,base,version:'2.1-primary-row-vas'};
  if(typeof module!=='undefined'&&module.exports)module.exports=config; else root.SymboConfig=config;
})(typeof window!=='undefined'?window:globalThis);
