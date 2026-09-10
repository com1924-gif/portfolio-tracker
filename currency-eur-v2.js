(()=>{
  if(window.__portfolioEURCurrencyInstalledV234)return;
  window.__portfolioEURCurrencyInstalledV234=true;

  const EUR_REFERENCE_HKD=9.10;
  if(state?.settings){
    state.settings.fx=state.settings.fx||{};
    if(!(Number(state.settings.fx.EUR)>0))state.settings.fx.EUR=EUR_REFERENCE_HKD;
  }

  const SELECT_IDS=['homeCurrency','portfolioCurrency','txCurrency','cashCurrency','cashFrom','cashTo','capitalCurrency'];

  function addEuroOption(select){
    if(!select||[...select.options].some(option=>option.value==='EUR'))return;
    const option=document.createElement('option');
    option.value='EUR';
    option.textContent='EUR';
    select.appendChild(option);
  }

  function install(){
    SELECT_IDS.forEach(id=>addEuroOption(document.getElementById(id)));
  }

  install();
  document.addEventListener('DOMContentLoaded',install,{once:true});
})();
