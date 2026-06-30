"use client";

import PlatformSearchForm, { type PlatformSearchParams } from "@/components/PlatformSearchForm";

export type InstaSearchParams = {
  profileUrl: string;
  keyword: string;
  hashtag: string;
  maxVideos: number;
  countryCode: string;
};

type InstaChannelFormProps = {
  onSubmit: (params: InstaSearchParams) => void;
  isLoading: boolean;
};

export default function InstaChannelForm({ onSubmit, isLoading }: InstaChannelFormProps) {
  const handleSubmit = (params: PlatformSearchParams) => {
    onSubmit({
      profileUrl: params.profileUrl || "",
      keyword: params.keyword,
      hashtag: params.hashtag,
      maxVideos: params.maxVideos,
      countryCode: params.countryCode,
    });
  };

  return <PlatformSearchForm platform="instagram" onSubmit={handleSubmit} isLoading={isLoading} />;
}
