// Ported from ensureCBVM() (lines 7992-8008): vq = queues whose name
// doesn't match /chat|email/i — for our 4 queues that's all of them, so
// vq[0]=Retail_Billing_L1, vq[1]=Retail_Complaints.
import { CUST, VMTXT } from './callers';

export function seedCallbacks() {
  return [
    { id: 'cb1', customer: CUST[0][0], ani: CUST[0][1], queue: 'Retail_Billing_L1', reqAt: '09:12', due: null, state: 'Waiting', attempts: 0, by: 'IVR offer (pressed 1 in queue)', notes: 'Billing dispute — kept queue position' },
    { id: 'cb2', customer: CUST[1][0], ani: CUST[1][1], queue: 'Retail_Billing_L1', reqAt: '09:48', due: null, state: 'Waiting', attempts: 0, by: 'IVR offer (pressed 1 in queue)', notes: '' },
    { id: 'cb3', customer: CUST[2][0], ani: CUST[2][1], queue: 'Retail_Complaints', reqAt: '10:05', due: '15:30', state: 'Waiting', attempts: 0, by: 'Agent scheduled', notes: 'Asked for an afternoon call' },
  ];
}

export function seedVoicemails() {
  return [
    { id: 'vm1', from: CUST[3][0], ani: CUST[3][1], queue: 'Retail_Billing_L1', at: '08:41', dur: 34, transcript: VMTXT[0], state: 'New' },
    { id: 'vm2', from: CUST[4][0], ani: CUST[4][1], queue: 'Retail_Complaints', at: '09:15', dur: 27, transcript: VMTXT[1], state: 'New' },
    { id: 'vm3', from: CUST[5][0], ani: CUST[5][1], queue: 'Retail_Billing_L1', at: '09:52', dur: 41, transcript: VMTXT[2], state: 'Heard' },
  ];
}
