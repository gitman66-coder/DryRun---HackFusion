import { Badge } from '../ui/Badge'
export function RiskBadge({ risk }: { risk: string }) { const tone = risk === 'low' ? 'green' : risk === 'medium' ? 'blue' : 'amber'; return <Badge tone={tone}>{risk} risk</Badge> }
