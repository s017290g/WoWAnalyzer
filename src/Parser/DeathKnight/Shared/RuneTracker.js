import React from 'react';

import RESOURCE_TYPES from 'common/RESOURCE_TYPES';
import SPELLS from 'common/SPELLS';
import ITEMS from 'common/ITEMS';
import { formatNumber , formatPercentage } from 'common/format';
import Wrapper from 'common/Wrapper';
import SpellIcon from 'common/SpellIcon';

import Analyzer from 'Parser/Core/Analyzer';
import Combatants from 'Parser/Core/Modules/Combatants';
import ResourceTracker from 'Parser/Core/Modules/ResourceTracker/ResourceTracker';
import SpellUsable from 'Parser/Core/Modules/SpellUsable';
import CastEfficiency from 'Parser/Core/Modules/CastEfficiency';

import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';


//TODO
//add cooldown reduction through spells

/*
 * Runes are tracked as 3 fake spells with 2 charges to similate 3 runes charging at the same time.
 * aslong as spells always use the rune pair with the shortest cooldown remaining it should match
 * its in game functionality.
 */
class RuneTracker extends Analyzer {
  static dependencies = {
    spellUsable: SpellUsable,
    castEfficiency: CastEfficiency,
  };

  timeSpentWithRunesOnCooldown = {};
  resourceType = RESOURCE_TYPES.RUNES.id;

  on_byPlayer_cast(event) {
  	event.classResources
      .filter(resource => resource.type === this.resourceType)
      .forEach(({ amount, cost }) => {
        const runeAmount = amount;
        const runeCost = cost || 0;
        //should add a check here to see if amount matches our rune cooldown. If it does not, update our rune cooldown to match.
      	for(let i = 0; i < cost; i++){
      		this.startCooldown();
      	}
      });
  }

  startCooldown(){
  	const runeId = this.shortestCooldown;
  	this.spellUsable.beginCooldown(runeId);
  }

  get shortestCooldown(){
  	const runeOneCooldown = this.getCooldown(SPELLS.RUNE_1.id) || 0;
  	const runeTwoCooldown = this.getCooldown(SPELLS.RUNE_2.id) || 0;
  	const runeThreeCooldown = this.getCooldown(SPELLS.RUNE_3.id) || 0;
  	if(runeOneCooldown <= runeTwoCooldown && runeOneCooldown <= runeThreeCooldown){
  		return SPELLS.RUNE_1.id;
  	}
  	if(runeTwoCooldown <= runeThreeCooldown){
  		return SPELLS.RUNE_2.id;
  	}
  	return SPELLS.RUNE_3.id;
  }

  getCooldown(spellId){
  	if(!this.spellUsable.isOnCooldown(spellId)){
  		return null;
  	}
  	const chargesOnCooldown = 2 - this.spellUsable.chargesAvailable(spellId);
  	const cooldownRemaining = this.spellUsable.cooldownRemaining(spellId);
  	return (chargesOnCooldown - 1) * 10000 + cooldownRemaining;
  }

  get runeEfficiency(){
    let runeCastEfficiencies = [];
    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    runeCastEfficiencies.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_1.id).efficiency);
    runeCastEfficiencies.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_2.id).efficiency);
    runeCastEfficiencies.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_3.id).efficiency);
    return runeCastEfficiencies.reduce(reducer) / runeCastEfficiencies.length;
  }

  get runesWasted(){
    let runeMaxCasts = [];
    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    runeMaxCasts.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_1.id).maxCasts);
    runeMaxCasts.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_2.id).maxCasts);
    runeMaxCasts.push(this.castEfficiency.getCastEfficiencyForSpellId(SPELLS.RUNE_3.id).maxCasts);
    const maxCasts = runeMaxCasts.reduce(reducer);
    return maxCasts * (1 - this.runeEfficiency);
  }

  get suggestionThresholds() {
    return {
      actual: 1 - this.runeEfficiency,
      isGreaterThan: {
        minor: 0.05,
        average: 0.1,
        major: 0.2,
      },
      style: 'percentage',
    };
  }

  get suggestionThresholdsEfficiency() {
    return {
      actual: this.runeEfficiency,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.8,
      },
      style: 'percentage',
    };
  }

  suggestions(when) {
    when(this.suggestionThresholds).addSuggestion((suggest, actual, recommended) => {
      return suggest(<Wrapper>You overcapped {formatPercentage(actual)}% of your runes. Try to always have atleast 3 runes on cooldown.</Wrapper>)
        .icon(SPELLS.RUNE_1.icon)
        .actual(`${formatPercentage(actual)}% runes overcapped`)
        .recommended(`<${formatPercentage(recommended)}% is recommended`);
    });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.RUNE_1.id} />}
        value={`${formatPercentage(1 - this.runeEfficiency)} %`}
        label="Runes overcapped"
        tooltip={`
          Number of runes wasted: ${formatNumber(this.runesWasted)}
        `}
      />
    );
  }
  statisticOrder = STATISTIC_ORDER.CORE(1);
  
}

export default RuneTracker;
