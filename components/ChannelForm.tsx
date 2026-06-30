"use client";

import PlatformSearchForm, { type PlatformSearchParams } from "@/components/PlatformSearchForm";

export type SearchParams = {
  channelUrl: string;
  keyword: string;
  hashtag: string;
  maxVideos: number;
  countryCode: string;
};

type ChannelFormProps = {
  onSubmit: (params: SearchParams) => void;
  isLoading: boolean;
};

export default function ChannelForm({ onSubmit, isLoading }: ChannelFormProps) {
  const handleSubmit = (params: PlatformSearchParams) => {
    onSubmit({
      channelUrl: params.channelUrl || "",
      keyword: params.keyword,
      hashtag: params.hashtag,
      maxVideos: params.maxVideos,
      countryCode: params.countryCode,
    });
  };

  return <PlatformSearchForm platform="tiktok" onSubmit={handleSubmit} isLoading={isLoading} />;
}
