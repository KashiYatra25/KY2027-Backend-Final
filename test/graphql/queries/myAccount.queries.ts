/**
 * GraphQL Test Queries - myAccount
 * 
 * Copy these queries to Postman/GraphQL Playground for testing
 * Make sure to include Authorization header with Bearer token
 */

// ═══════════════════════════════════════════════════════════════════
// FULL QUERIES - Get everything
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_FULL = `
query GetMyAccountFull {
  myAccount {
    profile {
      id
      email
      firstName
      lastName
      slugName
      avatarUrl
      phone
      gender
      college
      dob
      joinedAt
      adhaarNumber
      role {
        id
        level
      }
    }
    progress {
      steps {
        aadhaarUploaded
        aadhaarVerified
        college
        phone
      }
      completedSteps
      totalSteps
      completionPercentage
      currentStep
      isProfileComplete
      accountStatus
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// PROFILE ONLY QUERIES
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_PROFILE_ONLY = `
query GetMyProfile {
  myAccount {
    profile {
      id
      email
      firstName
      lastName
      slugName
      avatarUrl
      phone
      gender
      college
      dob
      joinedAt
      adhaarNumber
      role {
        id
        level
      }
    }
  }
}
`;

export const MY_ACCOUNT_PROFILE_BASIC = `
query GetMyProfileBasic {
  myAccount {
    profile {
      id
      email
      firstName
      lastName
      avatarUrl
    }
  }
}
`;

export const MY_ACCOUNT_PROFILE_CONTACT = `
query GetMyProfileContact {
  myAccount {
    profile {
      id
      email
      phone
      college
    }
  }
}
`;

export const MY_ACCOUNT_PROFILE_IDENTITY = `
query GetMyProfileIdentity {
  myAccount {
    profile {
      id
      firstName
      lastName
      gender
      dob
      adhaarNumber
    }
  }
}
`;

export const MY_ACCOUNT_PROFILE_WITH_ROLE = `
query GetMyProfileWithRole {
  myAccount {
    profile {
      id
      email
      slugName
      role {
        id
        level
      }
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// PROGRESS ONLY QUERIES
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_PROGRESS_ONLY = `
query GetMyProgress {
  myAccount {
    progress {
      steps {
        aadhaarUploaded
        aadhaarVerified
        college
        phone
      }
      completedSteps
      totalSteps
      completionPercentage
      currentStep
      isProfileComplete
      accountStatus
    }
  }
}
`;

export const MY_ACCOUNT_PROGRESS_STEPS = `
query GetMyProgressSteps {
  myAccount {
    progress {
      steps {
        aadhaarUploaded
        aadhaarVerified
        college
        phone
      }
      currentStep
    }
  }
}
`;

export const MY_ACCOUNT_PROGRESS_STATUS = `
query GetMyProgressStatus {
  myAccount {
    progress {
      isProfileComplete
      accountStatus
      completionPercentage
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// MINIMAL QUERIES - For lightweight checks
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_EXISTS = `
query CheckMyAccount {
  myAccount {
    profile {
      id
    }
  }
}
`;

export const MY_ACCOUNT_IS_COMPLETE = `
query IsProfileComplete {
  myAccount {
    progress {
      isProfileComplete
    }
  }
}
`;

export const MY_ACCOUNT_CURRENT_STEP = `
query GetCurrentStep {
  myAccount {
    progress {
      currentStep
      completedSteps
      totalSteps
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// COMBINED QUERIES - Common use cases
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_NAVBAR = `
query GetNavbarData {
  myAccount {
    profile {
      id
      firstName
      avatarUrl
      slugName
    }
  }
}
`;

export const MY_ACCOUNT_PROFILE_PAGE = `
query GetProfilePageData {
  myAccount {
    profile {
      id
      email
      firstName
      lastName
      slugName
      avatarUrl
      phone
      gender
      college
      dob
      joinedAt
      adhaarNumber
    }
    progress {
      isProfileComplete
      completionPercentage
      accountStatus
    }
  }
}
`;

export const MY_ACCOUNT_COMPLETE_PROFILE_PAGE = `
query GetCompleteProfilePageData {
  myAccount {
    profile {
      id
      firstName
      lastName
      phone
      college
      adhaarNumber
    }
    progress {
      steps {
        aadhaarUploaded
        aadhaarVerified
        college
        phone
      }
      currentStep
      completedSteps
      totalSteps
      isProfileComplete
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// AADHAAR SPECIFIC QUERIES
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_AADHAAR_STATUS = `
query GetAadhaarStatus {
  myAccount {
    profile {
      adhaarNumber
    }
    progress {
      steps {
        aadhaarUploaded
        aadhaarVerified
      }
    }
  }
}
`;

// ═══════════════════════════════════════════════════════════════════
// EDGE CASE QUERIES - For testing specific scenarios
// ═══════════════════════════════════════════════════════════════════

export const MY_ACCOUNT_NULLABLE_FIELDS = `
query GetNullableFields {
  myAccount {
    profile {
      firstName
      lastName
      avatarUrl
      phone
      gender
      college
      dob
      adhaarNumber
      role {
        id
        level
      }
    }
  }
}
`;

export const MY_ACCOUNT_JOINED_AT = `
query GetJoinedAt {
  myAccount {
    profile {
      id
      joinedAt
    }
  }
}
`;

export const MY_ACCOUNT_ENUM_FIELDS = `
query GetEnumFields {
  myAccount {
    profile {
      gender
      role {
        level
      }
    }
    progress {
      accountStatus
    }
  }
}
`;
