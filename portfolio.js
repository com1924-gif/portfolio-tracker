// Portfolio management extension for Portfolio Tracker v1.5
(function(){
  function normalizePortfolioLabels(){
    const select=document.getElementById('accountSelect');
    if(select && select.options.length && select.options[0].value==='all') select.options[0].text='All Portfolios';
    const title=document.getElementById('accountTitle');
    if(title && typeof selectedAccount!=='undefined' && selectedAccount==='all') title.textContent='All Portfolios';
  }

  window.openPortfolioModal=()=>openModal('portfolioModal');

  function savePortfolioDirect(){
    try{
      const input=document.getElementById('portfolioName');
      const name=input.value.trim();
      if(!name) return showToast('Please enter a portfolio name.',true);
      if(state.accounts.some(a=>a.name.toLowerCase()===name.toLowerCase())) return showToast('A portfolio with this name already exists.',true);
      const newPortfolio={id:uid('p'),name};
      state.accounts.push(newPortfolio);
      selectedAccount=newPortfolio.id;
      save();
      closeModal('portfolioModal');
      document.getElementById('portfolioForm').reset();
      render();
      normalizePortfolioLabels();
      showToast('Portfolio saved.');
    }catch(err){
      console.error(err);
      showToast('Could not save portfolio: '+err.message,true);
    }
  }

  const saveBtn=document.getElementById('savePortfolioBtn');
  if(saveBtn) saveBtn.addEventListener('click',savePortfolioDirect);

  if(typeof populateSelects==='function'){
    const basePopulate=populateSelects;
    populateSelects=function(){
      basePopulate();
      normalizePortfolioLabels();
    };
  }
  if(typeof render==='function'){
    const baseRender=render;
    render=function(){
      baseRender();
      normalizePortfolioLabels();
    };
  }

  normalizePortfolioLabels();
})();
