

import { Timestamp } from "firebase/firestore";

export interface Employee {
  id: string; // This will be the Firebase Auth UID
  name: string;
  email: string;
  avatar: string;
  role: 'employee' | 'admin';
  // Optional profile fields
  title?: string; // Job Title
  department?: string; // Department / Team
  employeeCode?: string; // Employee ID
  phone?: string; // Contact phone
  phoneHidden?: boolean; // Hide phone from others
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  joiningDate?: string; // yyyy-MM-dd
  reportingManager?: string;
  roleDescription?: string; // Current Role & Responsibilities
  // Social links
  linkedin?: string;
  instagram?: string;
  github?: string;
}

export interface DailyLog {
  id: string;
  employeeId: string;
  date: string; 
  notes?: string;
  // All other fields are dynamic
  [key: string]: any;
}

export interface AssignedTask {
  id: string;
  employeeId: string;
  task: string;
  assignedBy: string;
  isCompleted: boolean;
  assignedAt: Timestamp | Date;
}

export interface Resource {
  id: string;
  category: string;
  title: string;
  content: string;
}

export interface PerformanceData {
  employeeName: string;
  linkedinConnections: number;
  followUps: number;
  coldEmails: number;
  leadsGenerated: number;
}

export interface VisitorLog {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  loginTime: {
      seconds: number,
      nanoseconds: number
  };
  ipAddress: string;
  userAgent: string;
}

export interface Announcement {
    id: string;
    message: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    };
    updatedBy: string;
}

export interface FakeEmployee {
  id: string;
  name: string;
  email: string;
  joinDate: {
    seconds: number;
    nanoseconds: number;
  };
  status: 'Active' | 'Training' | 'Inactive';
}

export interface TaskField {
  id: string;
  label: string;
  placeholder: string;
  name: string; // e.g. "linkedinConnections"
  // Optional visibility scope. Default is 'all' if not present for backward compatibility.
  scope?: 'all' | 'specific';
  // When scope === 'specific', restrict this field to these employee IDs
  employeeIds?: string[];
}

export interface GenericApiKey {
    id: string;
    websiteName: string;
    apiKey: string;
}
