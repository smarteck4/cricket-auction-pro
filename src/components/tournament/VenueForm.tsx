import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Venue } from '@/lib/tournament-types';

interface VenueFormProps {
  venue?: Venue | null;
  onSubmit: (data: Partial<Venue>) => void;
  onCancel: () => void;
}

export function VenueForm({ venue, onSubmit, onCancel }: VenueFormProps) {
  const [name, setName] = useState(venue?.name || '');
  const [city, setCity] = useState(venue?.city || '');
  const [country, setCountry] = useState(venue?.country || '');
  const [capacity, setCapacity] = useState(venue?.capacity?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      city,
      country,
      capacity: capacity ? parseInt(capacity) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Venue Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Wankhede Stadium"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g., Mumbai"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g., India"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="e.g., 33000"
        />
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {venue ? 'Update Venue' : 'Add Venue'}
        </Button>
      </div>
    </form>
  );
}
