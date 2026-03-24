export interface TrackingLocation {
  city: string
  country: string
  coordinates: [number, number] // [longitude, latitude]
  users: number
  color: 'primary' | 'accent'
}

export const trackingLocations: TrackingLocation[] = [
  { city: 'София', country: 'България', coordinates: [23.3219, 42.6977], users: 15, color: 'primary' },
  { city: 'Пловдив', country: 'България', coordinates: [24.7453, 42.1354], users: 6, color: 'primary' },
  { city: 'Варна', country: 'България', coordinates: [27.9147, 43.2141], users: 4, color: 'accent' },
  { city: 'Бургас', country: 'България', coordinates: [27.4626, 42.5048], users: 3, color: 'accent' },
  { city: 'Стара Загора', country: 'България', coordinates: [25.6252, 42.4258], users: 3, color: 'primary' },
  { city: 'Русе', country: 'България', coordinates: [25.9657, 43.8356], users: 2, color: 'accent' },
  { city: 'Благоевград', country: 'България', coordinates: [23.0943, 42.0116], users: 2, color: 'primary' },
  { city: 'Велико Търново', country: 'България', coordinates: [25.6129, 43.0757], users: 1, color: 'accent' },
  { city: 'Плевен', country: 'България', coordinates: [24.6167, 43.4170], users: 1, color: 'primary' },
]

export const totalUsers = trackingLocations.reduce((sum, loc) => sum + loc.users, 0)
export const totalCountries = 1
export const totalCities = trackingLocations.length
export const uptimePercent = 99.97

export function planBreakdown(total: number) {
  const exclusive = Math.max(1, Math.round(total * 0.05))
  const pro = Math.max(1, Math.round(total * 0.22))
  const free = total - pro - exclusive
  return { free, pro, exclusive }
}
