// =============================================================================
// DWY Packages Service
// Phase 3: Done-With-You Premium Services
// =============================================================================

import { supabase } from '../../core/supabase/client';
import type {
  DwyPackage,
  DwyApplication,
  DwyApplicationFormData,
  DwyEngagement,
} from './dwyTypes';

export const dwyService = {
  // ===========================================================================
  // Packages
  // ===========================================================================

  /**
   * Get all active DWY packages
   */
  async getPackages(): Promise<DwyPackage[]> {
    const { data, error } = await supabase
      .from('dwy_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return (data || []).map(pkg => ({
      ...pkg,
      features: pkg.features as DwyPackage['features'],
    }));
  },

  /**
   * Get a specific package by tier
   */
  async getPackageByTier(tier: string): Promise<DwyPackage | null> {
    const { data, error } = await supabase
      .from('dwy_packages')
      .select('*')
      .eq('tier', tier)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      features: data.features as DwyPackage['features'],
    };
  },

  /**
   * Get a specific package by ID
   */
  async getPackageById(id: string): Promise<DwyPackage | null> {
    const { data, error } = await supabase
      .from('dwy_packages')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      features: data.features as DwyPackage['features'],
    };
  },

  // ===========================================================================
  // Applications
  // ===========================================================================

  /**
   * Submit a new application for a DWY package
   */
  async submitApplication(
    packageId: string,
    formData: DwyApplicationFormData
  ): Promise<DwyApplication> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_applications')
      .insert({
        creator_id: user.id,
        package_id: packageId,
        business_name: formData.business_name,
        business_type: formData.business_type,
        current_revenue: formData.current_revenue,
        goals: formData.goals,
        timeline: formData.timeline,
        website_url: formData.website_url || null,
        social_links: formData.social_links || {},
        how_heard: formData.how_heard || null,
        additional_notes: formData.additional_notes || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('You already have an application for this package');
      }
      throw error;
    }
    return data;
  },

  /**
   * Get all of the current user's applications
   */
  async getMyApplications(): Promise<DwyApplication[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_applications')
      .select('*, package:dwy_packages(*)')
      .eq('creator_id', user.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(app => ({
      ...app,
      package: app.package ? {
        ...app.package,
        features: app.package.features as DwyPackage['features'],
      } : undefined,
    }));
  },

  /**
   * Get a specific application by ID
   */
  async getApplicationById(id: string): Promise<DwyApplication | null> {
    const { data, error } = await supabase
      .from('dwy_applications')
      .select('*, package:dwy_packages(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      package: data.package ? {
        ...data.package,
        features: data.package.features as DwyPackage['features'],
      } : undefined,
    };
  },

  /**
   * Withdraw a pending application
   */
  async withdrawApplication(id: string): Promise<void> {
    const { error } = await supabase
      .from('dwy_applications')
      .update({ status: 'withdrawn' })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Check if creator has an active application for a package
   */
  async hasPendingApplication(packageId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('dwy_applications')
      .select('id')
      .eq('creator_id', user.id)
      .eq('package_id', packageId)
      .in('status', ['pending', 'under_review', 'interview_scheduled', 'approved'])
      .limit(1);

    if (error) return false;
    return (data && data.length > 0);
  },

  // ===========================================================================
  // Engagements
  // ===========================================================================

  /**
   * Get all of the current user's engagements
   */
  async getMyEngagements(): Promise<DwyEngagement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_engagements')
      .select('*, package:dwy_packages(*)')
      .eq('creator_id', user.id)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(eng => ({
      ...eng,
      milestones: eng.milestones as DwyEngagement['milestones'],
      package: eng.package ? {
        ...eng.package,
        features: eng.package.features as DwyPackage['features'],
      } : undefined,
    }));
  },

  /**
   * Get a specific engagement by ID
   */
  async getEngagementById(id: string): Promise<DwyEngagement | null> {
    const { data, error } = await supabase
      .from('dwy_engagements')
      .select('*, package:dwy_packages(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      milestones: data.milestones as DwyEngagement['milestones'],
      package: data.package ? {
        ...data.package,
        features: data.package.features as DwyPackage['features'],
      } : undefined,
    };
  },
};

export default dwyService;
