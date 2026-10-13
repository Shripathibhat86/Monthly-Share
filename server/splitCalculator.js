/**
 * Split Calculator Helper
 * Handles Equal, Custom, Percentage, and Weighted splits with 2-decimal paise precision.
 */

export function calculateEqualSplit(totalAmount, participantIds, payerId = null) {
  if (!participantIds || participantIds.length === 0) {
    throw new Error('At least one participant must be selected');
  }

  const count = participantIds.length;
  const totalPaise = Math.round(Number(totalAmount) * 100);
  const basePaise = Math.floor(totalPaise / count);
  let remainderPaise = totalPaise - (basePaise * count);

  return participantIds.map((memberId) => {
    let memberPaise = basePaise;
    // Assign remainder paise to payer if among participants, or first participant
    const shouldGetRemainder = (payerId && memberId === payerId && remainderPaise > 0) ||
                               (!participantIds.includes(payerId) && remainderPaise > 0);
    if (remainderPaise > 0) {
      memberPaise += 1;
      remainderPaise -= 1;
    }

    return {
      member_id: Number(memberId),
      allocated_amount: Number((memberPaise / 100).toFixed(2)),
      split_value: null
    };
  });
}

export function calculatePercentageSplit(totalAmount, participants) {
  // participants: [ { member_id, percentage } ]
  if (!participants || participants.length === 0) {
    throw new Error('At least one participant must be selected');
  }

  const totalPercent = participants.reduce((sum, p) => sum + Number(p.percentage || 0), 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Total percentage must equal 100%. Current sum: ${totalPercent}%`);
  }

  const totalPaise = Math.round(Number(totalAmount) * 100);
  let allocatedPaiseSum = 0;

  const result = participants.map((p) => {
    const pct = Number(p.percentage);
    const paise = Math.round((totalPaise * pct) / 100);
    allocatedPaiseSum += paise;
    return {
      member_id: Number(p.member_id),
      allocated_amount: paise / 100,
      split_value: pct
    };
  });

  // Adjust any rounding discrepancy on the largest allocation
  const discrepancy = totalPaise - allocatedPaiseSum;
  if (discrepancy !== 0 && result.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < result.length; i++) {
      if (result[i].allocated_amount > result[maxIdx].allocated_amount) {
        maxIdx = i;
      }
    }
    const adjustedPaise = Math.round(result[maxIdx].allocated_amount * 100) + discrepancy;
    result[maxIdx].allocated_amount = Number((adjustedPaise / 100).toFixed(2));
  }

  return result.map(r => ({
    ...r,
    allocated_amount: Number(r.allocated_amount.toFixed(2))
  }));
}

export function calculateWeightedSplit(totalAmount, participants) {
  // participants: [ { member_id, weight } ]
  if (!participants || participants.length === 0) {
    throw new Error('At least one participant must be selected');
  }

  const totalWeight = participants.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  if (totalWeight <= 0) {
    throw new Error('Total weight must be greater than zero');
  }

  const totalPaise = Math.round(Number(totalAmount) * 100);
  let allocatedPaiseSum = 0;

  const result = participants.map((p) => {
    const weight = Number(p.weight);
    const paise = Math.round((totalPaise * weight) / totalWeight);
    allocatedPaiseSum += paise;
    return {
      member_id: Number(p.member_id),
      allocated_amount: paise / 100,
      split_value: weight
    };
  });

  // Adjust rounding discrepancy
  const discrepancy = totalPaise - allocatedPaiseSum;
  if (discrepancy !== 0 && result.length > 0) {
    const adjustedPaise = Math.round(result[0].allocated_amount * 100) + discrepancy;
    result[0].allocated_amount = Number((adjustedPaise / 100).toFixed(2));
  }

  return result.map(r => ({
    ...r,
    allocated_amount: Number(r.allocated_amount.toFixed(2))
  }));
}

export function validateCustomSplit(totalAmount, participants) {
  // participants: [ { member_id, amount } ]
  if (!participants || participants.length === 0) {
    throw new Error('At least one participant must be selected');
  }

  const totalAllocated = participants.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const diff = Math.abs(Number(totalAmount) - totalAllocated);

  if (diff > 0.01) {
    throw new Error(
      `Sum of custom shares (₹${totalAllocated.toFixed(2)}) does not match total amount (₹${Number(totalAmount).toFixed(2)})`
    );
  }

  return participants.map((p) => ({
    member_id: Number(p.member_id),
    allocated_amount: Number(Number(p.amount).toFixed(2)),
    split_value: Number(Number(p.amount).toFixed(2))
  }));
}
